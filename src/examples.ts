export interface ExampleDoc {
  slug: string;
  title: string;
  description: string;
  source: string;
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
  const modules = import.meta.glob('../examples/*/note.mk.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  });
  return Object.entries(modules).map(([path, source]) => {
    const dir = path.split('/')[2] ?? '';
    const slug = dir.replace(/^\d+-/, '');
    const frontmatter = parseFrontmatter(source);
    return {
      slug,
      title: frontmatter.title ?? slug,
      description: frontmatter.description ?? '',
      source,
    };
  });
}

export const EXAMPLES = buildIndex();