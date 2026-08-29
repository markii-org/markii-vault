import { createRegistry } from '@markii/react';
import type { Registry } from '@markii/react';
import { HnActivity } from './hn-activity';
import { HnDomains } from './hn-domains';
import { HnList } from './hn-list';
import { HnTopics } from './hn-topics';

/**
 * The `hn` pack: dashboard components for Hacker News data, shipped
 * alongside the note that uses them (this example is a self-contained
 * package — note, Lua script, and pack travel together, per the "examples
 * are meant to be copied" rule). The manifest is `pack.json` next to this
 * file; the application still installs the pack at build time the way
 * docs/packs.md describes — registry entries under a namespaced prefix
 * (`hn_`), the note itself carries only `uses: [hn]` in frontmatter and
 * never any runtime. All four components are blocks bound to `data=`
 * paths in the value store.
 */
export const hnRegistry: Registry = createRegistry({
  'hn_list': { component: HnList },
  'hn_domains': { component: HnDomains },
  'hn_topics': { component: HnTopics },
  'hn_activity': { component: HnActivity },
});