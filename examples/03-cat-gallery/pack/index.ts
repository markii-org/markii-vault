import { createRegistry } from '@markii/react';
import type { Registry } from '@markii/react';
import { CatCard } from './cat-card';
import { CatGallery } from './cat-gallery';

/**
 * The `cat` pack: photo components for the Cat Gallery example, shipped
 * alongside the note that uses them (self-contained example — note, Lua
 * script, and pack travel together). The manifest is `pack.json` next to
 * this file; the application installs the pack at build time the way
 * docs/packs.md describes — registry entries under a namespaced prefix
 * (`cat-`), the note itself carries only `uses: [cat]` in frontmatter and
 * never any runtime. Both components are blocks bound to `data=` paths in
 * the value store.
 */
export const catRegistry: Registry = createRegistry({
  'cat-gallery': { component: CatGallery },
  'cat-card': { component: CatCard },
});