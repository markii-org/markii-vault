import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { renderMark, mergeRegistries } from '@markii/react';
import { defaultRegistry } from '@markii/react/components';
import { extractScripts, parse } from '@markii/core';
import { createValueStore, runDocumentScripts } from '@markii/runtime';
import type { RunSummary, ScriptExecutor } from '@markii/runtime';
import { createLuaExecutor } from '@markii/lua';
import {
  createFetchNetProvider,
  createMemoryCacheProvider,
  DEMO_NET_GRANTS,
} from './script-host';
// Vite `?url` asset import: ships wasmoon's `glue.wasm` as a hashed file in
// this app's own build output and resolves to that local URL at runtime,
// instead of `@markii/lua`'s default (unconfigured) browser behavior of
// fetching it from `https://unpkg.com/wasmoon@<version>/dist/glue.wasm` —
// see `@markii/lua`'s `createEmptyLuaEngine`/`RunScriptOptions` doc comments
// for why that CDN default exists and why a host would want to avoid it.
// `*?url` is typed by `vite/client` (already in this app's `tsconfig.json`).
import wasmUrl from 'wasmoon/dist/glue.wasm?url';
import { CodeEditor } from './CodeEditor';
import { PreviewErrorBoundary } from './PreviewErrorBoundary';
import { getParseStatus } from './parse-status';
import { EXAMPLES } from './examples';
import type { ExampleDoc } from './examples';
import { NavBar } from './NavBar';
import { BundleFilePanel } from './BundleFilePanel';
import { applyBundleImageUrls } from './document-images';
import { hnRegistry } from '../../examples/02-hn-pulse/pack';
import { catRegistry } from '../../examples/03-cat-gallery/pack';

const DEBOUNCE_MS = 200;

/**
 * The vault's registry: the standard component set plus every pack the
 * examples ship with, merged exactly the way an application installs
 * packs (docs/packs.md — packs are app-side configuration, never
 * note-side). `mergeRegistries` gives later entries precedence, so none
 * of the standard names can be shadowed by a pack.
 */
const registry = mergeRegistries(defaultRegistry, hnRegistry, catRegistry);

/**
 * SECURITY NOTE (spec §10): every executor this function builds runs
 * wasmoon **on the main thread**. Per docs/security.md, a real host MUST
 * run note scripts in a dedicated, terminatable Web Worker with an
 * EXTERNAL wall-clock watchdog that calls `terminate()`, since in-VM
 * limits alone cannot guarantee a hostile or hung script can be stopped.
 * Running on the main thread here is acceptable ONLY because this is a
 * showcase executing its own *curated* example scripts, not a host
 * rendering untrusted notes. Do not copy this pattern into a production
 * renderer.
 *
 * The executor used to be a single module-scope constant, built once for
 * the whole session. The bundle example needs a different capability
 * configuration (a `bundle: ScriptView` so `bundle.read` and bundle-local
 * `require` resolve, see `@markii/lua`'s `RunScriptOptions.bundle` doc
 * comment) than the three plain-file examples, which pass none. `App`
 * therefore builds one executor per example, memoized on the example
 * itself, so switching examples rebuilds it but neither a render nor a
 * keystroke does, matching `LuaExecutorConfig`'s own doc comment: "captured
 * once and reused for every script the returned executor runs".
 */
function buildLuaExecutor(doc: ExampleDoc): ScriptExecutor {
  return createLuaExecutor({
    net: createFetchNetProvider(),
    netGrants: DEMO_NET_GRANTS,
    cache: createMemoryCacheProvider(),
    // Local bundled asset (see the `wasmUrl` import above): keeps this app
    // offline-capable instead of depending on the unpkg CDN at script-run
    // time.
    wasmUri: wasmUrl,
    // Bundle-scoped filesystem (docs/scripting.md §11): present only for the
    // one example that is a directory-form bundle. Serves BOTH
    // `bundle.read("assets/...")` and bundle-local `require "scripts/..."`
    // through the SAME `ScriptView` and path-jail (`@markii/lua`'s
    // `require.ts`).
    bundle: doc.bundle?.scriptView,
  });
}

type RunState =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'done'; summary: RunSummary };

function statusLine(runState: RunState): string {
  switch (runState.phase) {
    case 'idle':
      return 'not yet run — values below are missing until you click Run';
    case 'running':
      return 'running…';
    case 'done': {
      const { summary } = runState;
      const parts = summary.results.map((entry) =>
        entry.status === 'fresh'
          ? `${entry.name}: fresh`
          : `${entry.name}: error (${entry.error ?? 'unknown error'})`,
      );
      return `${summary.freshCount} fresh, ${summary.errorCount} error${
        summary.errorCount === 1 ? '' : 's'
      } — ${parts.join('; ')}`;
    }
  }
}

/**
 * The GitHub "octocat" mark, inlined as a single hand-written `<path>`.
 *
 * Deliberately NOT an icon-library dependency: this repo's self-built-component
 * rule (AGENTS.md) applies to the apps too, and one 16×16 glyph does not
 * justify a package. `fill="currentColor"` lets the link's `color` (and its
 * hover transition) drive the icon, so there is no second palette to keep in
 * sync with `styles.css`. `aria-hidden` because the surrounding anchor already
 * carries the accessible name.
 */
/**
 * The fullscreen-mode indicator: a hand-drawn 16×16 maximize/restore
 * glyph (four corner strokes), following the repo's self-built-icon rule
 * (AGENTS.md) — `fill="none"` with `stroke="currentColor"` so the button's
 * color transition drives it, like GitHubMark above. `active` swaps the
 * corners between the outward (enter) and inward (exit) forms.
 */
function FullscreenGlyph({ active }: { active: boolean }): ReactElement {
  const d = active
    ? 'M8 3 V8 H3 M8 3 V8 H13 M8 13 V8 H13 M8 13 V8 H3'
    : 'M3 8 V3 h5 M13 8 V3 h-5 M13 8 V13 h-5 M3 8 V13 h5';
  return (
    <svg
      className="playground__fullscreen-icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

function GitHubMark(): ReactElement {
  return (
    <svg
      className="playground__repo-link-icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const FALLBACK: ExampleDoc = {
  slug: '',
  title: '',
  description: '',
  source: '',
};

function docAt(index: number): ExampleDoc {
  return EXAMPLES[index] ?? FALLBACK;
}

/** The `#slug` in the URL, validated against the index; unknown hashes land on example 0. */
function indexFromHash(hash: string): number {
  const slug = hash.replace(/^#/, '');
  if (!slug) return 0;
  const index = EXAMPLES.findIndex((doc) => doc.slug === slug);
  return index === -1 ? 0 : index;
}

export function App(): ReactElement {
  const initialIndex = useMemo(
    () => indexFromHash(window.location.hash),
    [],
  );
  const [exampleIndex, setExampleIndex] = useState(initialIndex);
  const [source, setSource] = useState(docAt(initialIndex).source);
  const [debounced, setDebounced] = useState(source);
  const [runState, setRunState] = useState<RunState>({ phase: 'idle' });
  // The value store is a mutable, note-scoped object per docs/scripting.md —
  // it must persist for the life of the session (one store, created once),
  // never rebuilt per render, or a run's results would vanish on the next
  // keystroke. `useRef` (not `useState`) because the store's identity never
  // needs to change and mutating it in place must NOT itself trigger a
  // render — `renderVersion` below is the explicit signal for that.
  const storeRef = useRef(createValueStore());
  // The store is mutated in place by `runDocumentScripts`, so React has no
  // way to detect that new values are available — this counter is bumped
  // after a run completes purely to force the preview to re-render and pick
  // up the new store contents.
  const [renderVersion, setRenderVersion] = useState(0);
  // Preview-only mode hides the editor pane so the rendered note spans the
  // full width; mainly used for taking a clean screenshot of a note.
  const [previewOnly, setPreviewOnly] = useState(false);

  const doc = docAt(exampleIndex);

  // Rebuilt only when the selected example changes (see `buildLuaExecutor`'s
  // doc comment), never on every render or keystroke, and never shared
  // across examples with different bundle wiring.
  const luaExecutor = useMemo(() => buildLuaExecutor(doc), [doc]);

  // Resolves a `src=scripts/etl.lua` reference (docs/scripting.md) through
  // the current example's bundle storage, when it has one. A plain-file
  // example's `doc.bundle` is undefined, so this always rejects for it,
  // matching `runDocumentScripts`' documented behavior for a `src=` block
  // with no `loadSource` at all (recorded as that one script's error,
  // never thrown out of the batch).
  const loadSource = useCallback(
    async (src: string): Promise<string> => {
      const bundle = doc.bundle;
      if (!bundle) {
        throw new Error(`no bundle is open; cannot resolve src "${src}"`);
      }
      const bytes = await bundle.scriptView.read(src);
      if (!bytes) {
        throw new Error(`no such bundle file "${src}"`);
      }
      return new TextDecoder().decode(bytes);
    },
    [doc],
  );

  // Rewrites relative `<img src>` values against the current example's
  // bundle assets after every render (see `document-images.ts`'s doc
  // comment for why this is a DOM post-process rather than a renderer
  // hook: `@markii/react`'s `renderMark` has no base-URI/asset-resolution
  // seam). A no-op for the three plain-file examples, whose `doc.bundle` is
  // undefined.
  const previewRef = useRef<HTMLDivElement>(null);

  const navigateTo = useCallback((next: number): void => {
    setExampleIndex(next);
    setSource(docAt(next).source);
    setRunState({ phase: 'idle' });
    // Examples are navigated in-session with history.replaceState so the
    // browser's back button leaves the vault rather than walking the
    // example list; the `#slug` hash stays deep-linkable and shareable.
    const slug = docAt(next).slug;
    if (window.location.hash !== `#${slug}`) {
      window.history.replaceState(null, '', `#${slug}`);
    }
  }, []);

  useEffect(() => {
    document.title = doc.title ? `${doc.title} · Vault Playground` : 'Vault Playground';
  }, [doc.title]);

  // ESC leaves preview-only mode; the toggle button in the Preview pane
  // title is the mouse path out (the title stays visible in that mode).
  useEffect(() => {
    if (!previewOnly) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setPreviewOnly(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewOnly]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(source);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [source]);

  const parseStatus = useMemo(() => getParseStatus(debounced), [debounced]);

  const handleRun = useCallback(async (): Promise<void> => {
    setRunState({ phase: 'running' });
    const scripts = extractScripts(parse(source));
    const summary = await runDocumentScripts({
      scripts,
      executor: luaExecutor,
      trigger: 'manual',
      store: storeRef.current,
      loadSource,
    });
    setRunState({ phase: 'done', summary });
    setRenderVersion((v) => v + 1);
  }, [source, luaExecutor, loadSource]);

  const isRunning = runState.phase === 'running';
  // `renderVersion` has no meaningful value of its own — it is included
  // purely so this memo recomputes after a run mutates `storeRef.current`
  // in place (see the doc comment above `renderVersion`'s declaration).
  const preview = useMemo(
    () => renderMark(debounced, registry, storeRef.current),
    [debounced, renderVersion],
  );

  // Runs after every render this DOM commits, including a live edit: React
  // has already written the (unresolved) relative `src` values by the time
  // this fires, so a resolvable bundle image is corrected immediately after.
  useEffect(() => {
    if (previewRef.current) {
      applyBundleImageUrls(previewRef.current, doc.bundle?.assetUrls);
    }
  });

  return (
    <div className="playground">
      {!previewOnly && (
        <header className="playground__header">
          <div className="playground__header-text">
            <h1>Markii Vault</h1>
            <p>{doc.description}</p>
          </div>
          {/*
            The label is hidden by CSS on narrow viewports (the link collapses to
            the icon), so the accessible name lives on `aria-label` and does not
            depend on it — while still containing the visible word "GitHub"
            (WCAG 2.5.3 label-in-name).
          */}
          <a
            className="playground__button playground__button--ghost playground__repo-link"
            href="https://github.com/sadigaxund/markii-vault"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Markii Vault on GitHub"
          >
            <GitHubMark />
            <span className="playground__repo-link-label">GitHub</span>
          </a>
        </header>
      )}
      {!previewOnly && (
        <NavBar
          examples={EXAMPLES}
          index={exampleIndex}
          onNavigate={navigateTo}
        />
      )}
      <main
        className={[
          'playground__panes',
          previewOnly ? 'playground__panes--preview-only' : '',
          !previewOnly && doc.bundle ? 'playground__panes--with-bundle' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {!previewOnly && (
          <section className="playground__pane">
            <h2 className="playground__pane-title">Source</h2>
            <CodeEditor
              className="playground__editor"
              value={source}
              onChange={setSource}
            />
          </section>
        )}
        <section className="playground__pane">
          <div className="playground__pane-title playground__pane-title--row">
            <span>Preview</span>
            <div className="playground__pane-actions">
              <button
                type="button"
                className="playground__button playground__button--primary"
                onClick={() => void handleRun()}
                disabled={isRunning}
              >
                {isRunning ? 'Running…' : 'Run scripts'}
              </button>
              <button
                type="button"
                className="playground__button playground__button--ghost playground__fullscreen-toggle"
                onClick={() => setPreviewOnly((v) => !v)}
                aria-label={
                  previewOnly ? 'Exit preview-only mode (Esc)' : 'Preview-only mode'
                }
              >
                <FullscreenGlyph active={previewOnly} />
              </button>
            </div>
          </div>
          <div className="playground__preview">
            <PreviewErrorBoundary resetKey={debounced}>
              <div className="doc" ref={previewRef}>{preview}</div>
            </PreviewErrorBoundary>
          </div>
          {!previewOnly && (
            <>
              <p className="playground__scripting-status">
                {statusLine(runState)}
              </p>
              <p className="playground__status-bar">
                {parseStatus.ok
                  ? `ok — ${parseStatus.directiveCount} directive${parseStatus.directiveCount === 1 ? '' : 's'} found`
                  : `parse error — ${parseStatus.error}`}
              </p>
            </>
          )}
        </section>
        {!previewOnly && doc.bundle && <BundleFilePanel bundle={doc.bundle} />}
      </main>
      {!previewOnly && (
        <footer className="playground__footnote">
          Values are cached in the value store; rendering never runs scripts —
          only clicking Run does. Edits here are throwaway: each example's
          source lives in the examples/ folder of this repo. Scripts run on
          the main thread for simplicity; a production host must run them in a
          terminatable Web Worker with an external watchdog (docs/security.md).
        </footer>
      )}
    </div>
  );
}