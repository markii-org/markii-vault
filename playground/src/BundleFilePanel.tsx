import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { LoadedBundle } from './bundle-loader';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']);

function extensionOf(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot + 1).toLowerCase();
}

/**
 * Read-only file browser for the bundle example: `manifest.json`,
 * `scripts/*.lua`, and everything under `assets/`. The note document itself
 * (`note.mk.md`, or whatever `manifest.document` names) is excluded: it is
 * already the editable Source pane, so listing it again here would just be
 * a second, confusing, read-only copy of the same text.
 *
 * Shown only for the one example whose `ExampleDoc.bundle` field is set
 * (`App.tsx`); the other three examples never render this component at all,
 * so their layout is untouched.
 */
export function BundleFilePanel({
  bundle,
}: {
  bundle: LoadedBundle;
}): ReactElement {
  const documentPath = bundle.manifest.document ?? 'note.mk.md';
  const files = useMemo(
    () => bundle.files.filter((file) => file.path !== documentPath),
    [bundle, documentPath],
  );
  const [selected, setSelected] = useState<string>(files[0]?.path ?? '');
  const active = files.find((file) => file.path === selected) ?? files[0];

  return (
    <section className="playground__pane playground__bundle-pane">
      <h2 className="playground__pane-title">Bundle files</h2>
      <div className="playground__bundle-body">
        <ul className="playground__bundle-file-list">
          {files.map((file) => (
            <li key={file.path}>
              <button
                type="button"
                className={
                  file.path === active?.path
                    ? 'playground__bundle-file playground__bundle-file--active'
                    : 'playground__bundle-file'
                }
                onClick={() => setSelected(file.path)}
              >
                {file.path}
              </button>
            </li>
          ))}
        </ul>
        <div className="playground__bundle-viewer">
          {active === undefined ? (
            <p className="playground__bundle-empty">This bundle has no other files.</p>
          ) : IMAGE_EXTENSIONS.has(extensionOf(active.path)) && active.url ? (
            <img
              className="playground__bundle-image"
              src={active.url}
              alt={active.path}
            />
          ) : (
            <pre className="playground__bundle-text">{active.content ?? ''}</pre>
          )}
        </div>
      </div>
      <p className="playground__bundle-note">
        This bundle is opened read-only, in memory: its manifest grants only
        {' '}<code>read</code>, so a script write is denied, and nothing here
        persists past this browser tab.
      </p>
    </section>
  );
}
