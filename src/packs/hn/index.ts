import { createRegistry } from '@markii/react';
import type { Registry } from '@markii/react';
import { HnActivity } from './hn-activity';
import { HnDomains } from './hn-domains';
import { HnList } from './hn-list';
import { HnTopics } from './hn-topics';

/**
 * The `hn` pack: dashboard components for Hacker News data, installed into
 * the vault application exactly the way docs/packs.md describes a pack —
 * registry entries under a namespaced prefix (`hn-`), never into a note.
 * The note that uses them declares `uses: [hn]` in its frontmatter. All
 * four are block components bound to `data=` paths in the value store.
 */
export const hnRegistry: Registry = createRegistry({
  'hn-list': { component: HnList },
  'hn-domains': { component: HnDomains },
  'hn-topics': { component: HnTopics },
  'hn-activity': { component: HnActivity },
});