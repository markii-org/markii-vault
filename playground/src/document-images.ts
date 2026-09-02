/**
 * Resolving a bundle example's document-relative image sources in the
 * preview pane.
 *
 * `renderMark(text, registry, store, vault)` (`@markii/react`, 0.12.0) has no
 * image-resolution or base-URI seam: it renders `<img src="assets/diagram.png">`
 * exactly as written, and inside the playground's page that resolves against
 * the page's own URL, not the bundle's files, so it never loads. This is a
 * gap in the published API (reported alongside this batch's other findings):
 * a host embedding `@markii/react` has no supported hook to supply a base
 * URI or an asset resolver for document-relative images, and must
 * post-process the rendered DOM instead, exactly what this module does.
 *
 * This mirrors the reference approach in the Markii repo's VS Code
 * extension (`apps/vscode/src/webview/document-images.ts`), specifically its
 * two decisions:
 *
 * 1. Rewrite `<img src>` only, never inject a `<base href>`. A `<base>`
 *    would change the resolution of every relative URL on the page,
 *    in-document `#fragment` anchors included; narrowing the rewrite to
 *    `<img src>` keeps that blast radius at zero.
 * 2. Resolve, don't authorize. A value that already carries a scheme
 *    (`https:`, `data:`), a protocol-relative `//host/...`, or a bare
 *    `#fragment` is left exactly as it is. `@markii/core`'s `isSafeUrl` has
 *    already dropped `javascript:` sources upstream of this module; nothing
 *    here weakens that.
 */

/**
 * True when `value` begins with a URL scheme, using the same "text before
 * the first `:`, but only when that `:` precedes any `/`, `?` or `#`" rule
 * as `@markii/core`'s `isSafeUrl`, so a path that merely contains a colon
 * later on is correctly treated as relative, not schemed.
 */
function hasScheme(value: string): boolean {
  const colon = value.indexOf(':');
  if (colon === -1) return false;
  const slash = value.indexOf('/');
  const questionMark = value.indexOf('?');
  const numberSign = value.indexOf('#');
  return (
    (slash === -1 || colon < slash) &&
    (questionMark === -1 || colon < questionMark) &&
    (numberSign === -1 || colon < numberSign)
  );
}

/**
 * Normalizes a relative `src` into the key form `assetUrls` (built by
 * `bundle-loader.ts` from the bundle's own file list) uses: strips leading
 * `./` segments and a leading `/`, so `assets/diagram.png`,
 * `./assets/diagram.png`, and `/assets/diagram.png` all look up the same
 * entry. Never resolves `..`: a lookup key containing one simply will not
 * be in the map, since the map is built only from paths the bundle loader's
 * own glob actually found.
 */
function assetLookupKey(value: string): string {
  let result = value;
  while (result.startsWith('./')) result = result.slice(2);
  while (result.startsWith('/')) result = result.slice(1);
  return result;
}

/**
 * The resolved asset URL for a document-relative `value`, or `undefined`
 * when it must be left untouched: already-absolute values (a scheme, a
 * protocol-relative `//host/...`, a bare `#fragment`, empty/whitespace), and
 * any relative value that has no matching entry in `assetUrls` (a plain-file
 * example has none at all, so every `<img>` there is left alone).
 */
export function resolveBundleImageUrl(
  value: string,
  assetUrls: Readonly<Record<string, string>> | undefined,
): string | undefined {
  if (!assetUrls) return undefined;
  if (value.trim() === '') return undefined;
  if (value.startsWith('#')) return undefined;
  if (value.startsWith('//')) return undefined;
  if (hasScheme(value)) return undefined;
  return assetUrls[assetLookupKey(value)];
}

/**
 * Rewrites every relative `<img src>` inside `container` to its resolved
 * bundle-asset URL. Idempotent: a second pass sees an already-absolute
 * source and leaves it alone. Called from an effect after each render (see
 * `App.tsx`) so a live-edited note keeps its image resolved across
 * keystrokes; a no-op (immediately returns) when the current example is not
 * a bundle, so the other three examples' images are never touched by this
 * module.
 */
export function applyBundleImageUrls(
  container: ParentNode,
  assetUrls: Readonly<Record<string, string>> | undefined,
): void {
  if (!assetUrls) return;
  for (const image of container.querySelectorAll('img')) {
    const source = image.getAttribute('src');
    if (source === null) continue;
    const resolved = resolveBundleImageUrl(source, assetUrls);
    if (resolved !== undefined && resolved !== source) {
      image.setAttribute('src', resolved);
    }
  }
}
