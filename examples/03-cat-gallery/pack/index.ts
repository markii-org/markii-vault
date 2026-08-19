import { createRegistry } from '@markii/react';
import type { Registry } from '@markii/react';
import { CatCard } from './cat-card';
import { CatFinder } from './cat-finder';
import { CatGallery } from './cat-gallery';

/**
 * The `cat` pack: photo components for the Cat Gallery example, shipped
 * alongside the note that uses them (self-contained example — note, Lua
 * script, and pack travel together). The manifest is `pack.json` next to
 * this file; the application installs the pack at build time the way
 * docs/packs.md describes — registry entries under a namespaced prefix
 * (`cat-`), the note itself carries only `uses: [cat]` in frontmatter and
 * never any runtime. All components are blocks bound to `data=` paths in
 * the value store; `cat-finder` is the interactive one (chip row over
 * shared, guarded extraction).
 */
export const catRegistry: Registry = createRegistry({
  'cat-gallery': { component: CatGallery },
  'cat-card': { component: CatCard },
  'cat-finder': { component: CatFinder },
});