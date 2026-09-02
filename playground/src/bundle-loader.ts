import {
  createMemoryBundleStorage,
  createScriptView,
  grantAllDeclaredPermissions,
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
 * The storage itself is `@markii/bundle`'s own `createMemoryBundleStorage`
 * (0.13.0), a third `BundleStorage` form beside the zip and directory forms,
 * backed by a plain map. Every path it is given already routes through the
 * package's own path jail, so this module never reimplements one.
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
  /**
   * Bundle-relative path -> resolved asset URL, passed to `renderMark` as
   * `App.tsx`'s `resolveImageSrc` option (`@markii/react` 0.13.0) so a
   * relative `<img src>` resolves during the render itself.
   */
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
 * The bundle-relative text files (manifest, document, `scripts/*.lua`, and
 * `assets/*.json`) as a plain record, the shape `createMemoryBundleStorage`
 * takes. Binary assets (images) are left out: nothing in this vault ever
 * calls `bundle.read` on one, they reach the page through `assetUrls`
 * instead (built straight from Vite's `?url` glob, see `buildBundle`
 * below), and `createMemoryBundleStorage` needs their bytes up front rather
 * than lazily, which the build-time `?url` string alone cannot provide.
 */
function textFilesFor(files: readonly BundleFile[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const file of files) {
    if (file.kind === 'text' && file.content !== undefined) {
      result[file.path] = file.content;
    }
  }
  return result;
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
  const storage: BundleStorage = createMemoryBundleStorage(
    textFilesFor(sortedFiles),
  );
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
