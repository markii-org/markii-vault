import {
  createScriptView,
  grantAllDeclaredPermissions,
  normalizeOrThrow,
  parseManifest,
} from '@markii/bundle';
import type { BundleManifest, BundleStorage, ScriptView } from '@markii/bundle';

/**
 * Loads every directory-form `.mkz` bundle under `../../examples` at BUILD
 * time, through Vite's `import.meta.glob`, into an in-memory `BundleStorage`
 * the playground can run scripts against. There is exactly one such bundle
 * in this vault today (`04-edge-status.mkz`), but this module makes no
 * assumption about its name or its file list: both glob patterns below are
 * generic, and the grouping-by-bundle-root logic below works for any number
 * of `*.mkz` folders.
 *
 * The published @markii/bundle package (0.12.0) ships no in-memory
 * `BundleStorage` of its own (only the browser-safe zip form and a
 * Node-only directory form). See the gap noted in this batch's report. This
 * module is the minimal implementation the interface's own doc comment
 * calls for: every path argument is routed through the package's
 * `normalizeOrThrow`, never a second, locally-invented path check.
 *
 * The two glob patterns below (text extensions read via `?raw`, everything
 * else assumed binary and loaded via `?url`) are written INLINE as string
 * literals in each `import.meta.glob` call, not as named constants: Vite
 * statically analyzes the call site's source text at build time to decide
 * which files to bundle, and does not evaluate a variable reference there
 * (confirmed empirically: an earlier version of this file factored both
 * patterns into `const` variables and passed those, which built without
 * error but silently matched nothing at either call site, so this module's
 * `LOADED_BUNDLES` came back empty even though the compiler reported
 * success). Keep both patterns literal.
 */

const rawModules = import.meta.glob(
  '../../examples/*.mkz/**/*.{json,md,lua,csv,txt}',
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const urlModules = import.meta.glob(
  '../../examples/*.mkz/**/*.{png,jpg,jpeg,gif,svg,webp}',
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>;

type FileKind = 'text' | 'url';

/** One file inside a bundle, as loaded at build time. */
export interface BundleFile {
  /** Bundle-relative path, e.g. "scripts/etl.lua" or "assets/diagram.png". */
  path: string;
  kind: FileKind;
  /** Present when `kind === 'text'`. */
  content?: string;
  /** Present when `kind === 'url'`: the build-output URL Vite emitted for this asset. */
  url?: string;
}

/** One directory-form `.mkz` bundle, fully loaded and ready to run scripts against. */
export interface LoadedBundle {
  /** The bundle's folder name, e.g. "04-edge-status.mkz". */
  dirName: string;
  manifest: BundleManifest;
  /** Warnings from `parseManifest` (e.g. a legacy `mark` field), never swallowed. */
  warnings: string[];
  storage: BundleStorage;
  /**
   * A `ScriptView` granting exactly what the manifest DECLARES via
   * `grantAllDeclaredPermissions`, the fully-trusted convenience case
   * documented on that function. Appropriate here because this bundle
   * ships inside the vault repo itself (the playground's own example
   * content, not an untrusted `.mkz` opened from elsewhere); a real host
   * opening a bundle from outside its own repo must prompt the user and
   * pass their actual grant instead.
   */
  scriptView: ScriptView;
  /** Every file in the bundle, sorted by path, for the read-only file panel. */
  files: BundleFile[];
  /** Bundle-relative path -> resolved asset URL, for rewriting `<img src>` after render. */
  assetUrls: Record<string, string>;
}

/**
 * Given a glob key like "../../examples/04-edge-status.mkz/scripts/etl.lua",
 * returns `{ dirName: "04-edge-status.mkz", relPath: "scripts/etl.lua" }`,
 * or `undefined` if the key doesn't contain a `*.mkz` segment (shouldn't
 * happen given the glob patterns above, but this stays defensive rather
 * than assuming).
 */
function splitBundlePath(
  key: string,
): { dirName: string; relPath: string } | undefined {
  const segments = key.split('/');
  const bundleIndex = segments.findIndex((segment) => segment.endsWith('.mkz'));
  if (bundleIndex === -1) return undefined;
  const dirName = segments[bundleIndex] ?? '';
  const relPath = segments.slice(bundleIndex + 1).join('/');
  if (!relPath) return undefined;
  return { dirName, relPath };
}

/**
 * The minimal `BundleStorage` this bundle-loader needs: an in-memory,
 * read-mostly view over the files Vite's glob loaded at build time.
 *
 * Every method routes `path` through `normalizeOrThrow` FIRST, before
 * touching either map, per `@markii/bundle`'s own doc comment on
 * `BundleStorage`, that is the one and only path-jail choke point, and a
 * storage implementation that skipped it would unjail every `ScriptView`
 * built on top of it. Nothing here re-implements or duplicates that check.
 *
 * `write` is a session-scoped no-op in the sense that matters: nothing
 * persists across a page reload, and this bundle's manifest declares only
 * `["read"]` under `permissions.bundle` (no `write:cache/`), so
 * `createScriptView`'s grant intersection means a script's `bundle.write`
 * call is denied by the `ScriptView` layer before it would ever reach this
 * class. The map below exists purely so the interface is genuinely
 * satisfied (a write that WOULD be granted does not silently vanish
 * mid-session), not because this playground offers any durable cache.
 */
class MemoryBundleStorage implements BundleStorage {
  private readonly text = new Map<string, string>();
  private readonly urls = new Map<string, string>();
  private readonly writes = new Map<string, Uint8Array>();

  constructor(files: readonly BundleFile[]) {
    for (const file of files) {
      if (file.kind === 'text' && file.content !== undefined) {
        this.text.set(file.path, file.content);
      } else if (file.kind === 'url' && file.url !== undefined) {
        this.urls.set(file.path, file.url);
      }
    }
  }

  async read(path: string): Promise<Uint8Array | undefined> {
    const normalized = normalizeOrThrow(path);
    const write = this.writes.get(normalized);
    if (write !== undefined) return write;
    const text = this.text.get(normalized);
    if (text !== undefined) return new TextEncoder().encode(text);
    const url = this.urls.get(normalized);
    if (url !== undefined) {
      const response = await fetch(url);
      return new Uint8Array(await response.arrayBuffer());
    }
    return undefined;
  }

  async write(path: string, data: Uint8Array): Promise<void> {
    const normalized = normalizeOrThrow(path);
    this.writes.set(normalized, data);
  }

  async list(): Promise<string[]> {
    const paths = new Set<string>([
      ...this.text.keys(),
      ...this.urls.keys(),
      ...this.writes.keys(),
    ]);
    return [...paths].sort();
  }

  async exists(path: string): Promise<boolean> {
    const normalized = normalizeOrThrow(path);
    return (
      this.text.has(normalized) ||
      this.urls.has(normalized) ||
      this.writes.has(normalized)
    );
  }

  async size(path: string): Promise<number | undefined> {
    const normalized = normalizeOrThrow(path);
    const write = this.writes.get(normalized);
    if (write !== undefined) return write.length;
    const text = this.text.get(normalized);
    if (text !== undefined) return new TextEncoder().encode(text).length;
    if (this.urls.has(normalized)) {
      const bytes = await this.read(normalized);
      return bytes?.length;
    }
    return undefined;
  }
}

function buildBundle(dirName: string, files: BundleFile[]): LoadedBundle {
  const manifestFile = files.find((file) => file.path === 'manifest.json');
  const manifestJson = manifestFile?.content ?? '{}';
  const parsed = parseManifest(manifestJson);
  const manifest: BundleManifest = parsed.ok
    ? parsed.manifest
    : { spec: 'unknown' };
  const warnings = parsed.ok
    ? parsed.warnings
    : [`manifest.json failed to parse: ${parsed.errors.join('; ')}`];

  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const storage = new MemoryBundleStorage(sortedFiles);
  const scriptView = createScriptView(
    storage,
    manifest,
    grantAllDeclaredPermissions(manifest),
  );

  const assetUrls: Record<string, string> = {};
  for (const file of sortedFiles) {
    if (file.kind === 'url' && file.url !== undefined) {
      assetUrls[file.path] = file.url;
    }
  }

  return {
    dirName,
    manifest,
    warnings,
    storage,
    scriptView,
    files: sortedFiles,
    assetUrls,
  };
}

function loadAllBundles(): Map<string, LoadedBundle> {
  const byDir = new Map<string, BundleFile[]>();

  for (const [key, content] of Object.entries(rawModules)) {
    const split = splitBundlePath(key);
    if (!split) continue;
    const list = byDir.get(split.dirName) ?? [];
    list.push({ path: split.relPath, kind: 'text', content });
    byDir.set(split.dirName, list);
  }
  for (const [key, url] of Object.entries(urlModules)) {
    const split = splitBundlePath(key);
    if (!split) continue;
    const list = byDir.get(split.dirName) ?? [];
    list.push({ path: split.relPath, kind: 'url', url });
    byDir.set(split.dirName, list);
  }

  const result = new Map<string, LoadedBundle>();
  for (const [dirName, files] of byDir) {
    result.set(dirName, buildBundle(dirName, files));
  }
  return result;
}

/** Every directory-form bundle found under `examples/`, keyed by folder name (e.g. "04-edge-status.mkz"). Built once at module load. */
export const LOADED_BUNDLES: ReadonlyMap<string, LoadedBundle> = loadAllBundles();
