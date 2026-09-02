import { LOADED_BUNDLES } from './bundle-loader';
import type { LoadedBundle } from './bundle-loader';

export interface ExampleDoc {
  slug: string;
  title: string;
  description: string;
  source: string;
  /**
   * Present only for an example that is a directory-form `.mkz` bundle
   * (today: "04-edge-status.mkz"). `App.tsx` uses this field, rather than
   * matching on the slug string, to tell a bundle example apart from a
   * plain-file one: the file panel and the bundle-aware Run wiring both key
   * off its presence.
   */
  bundle?: LoadedBundle;
}

/**
 * Hand-rolled frontmatter reader, same philosophy as manifest validation
 * (docs/spec): no YAML dependency. Only the two keys the nav bar uses are
 * parsed (`title`, `description`); anything else is ignored. A missing
 * frontmatter block is fine: the title falls back to the slug.
 */
function parseFrontmatter(raw: string): {
  title?: string;
  description?: string;
} {
  if (!raw.startsWith('---')) return {};
  const end = raw.indexOf('\n---', 4);
  if (end === -1) return {};
  const header: { title?: string; description?: string } = {};
  for (const line of raw.slice(4, end).split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key === 'title' || key === 'description') header[key] = value;
  }
  return header;
}

/**
 * Every `examples/<NN>-<slug>/note.mk.md` becomes one entry, in folder
 * order. The `NN-` prefix is the sort order, the slug is the stable id
 * (used for the URL hash), and the note's own markdown is the source the
 * editor shows.
 */
function buildIndex(): ExampleDoc[] {
  const modules = import.meta.glob('../../examples/*/note.mk.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  });
  return Object.entries(modules).map(([path, source]) => {
    // The example folder is always the segment right before note.mk.md,
    // whatever depth the glob resolves at ('../examples/…' from src/,
    // '../../examples/…' from playground/src/ — a fixed index like [1]
    // would silently shift to 'examples' when the app moves).
    const dir = path.split('/').at(-2) ?? '';
    // Strip the "NN-" sort prefix, then a trailing ".mkz" bundle suffix
    // (a plain-file example has none, so this is a no-op for those), so a
    // bundle example's slug/URL hash matches its siblings' shape:
    // "04-edge-status.mkz" -> "edge-status".
    const slug = dir.replace(/^\d+-/, '').replace(/\.mkz$/, '');
    const frontmatter = parseFrontmatter(source);
    return {
      slug,
      title: frontmatter.title ?? slug,
      description: frontmatter.description ?? '',
      source,
      bundle: LOADED_BUNDLES.get(dir),
    };
  });
}

export const EXAMPLES = buildIndex();