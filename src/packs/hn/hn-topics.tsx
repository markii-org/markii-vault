import type { ReactElement } from 'react';
import type { MarkComponentProps } from '@markii/react';
import { failureTitle, int, isUnreadable, safeExtract, stateClassName, str } from './guard';

const MAX_EXTRACT = 100;
const LEVEL_COUNT = 4;

interface TopicRow {
  term: string;
  count: number;
}

function extractTopics(data: unknown): TopicRow[] {
  if (!Array.isArray(data)) return [];
  const rows: TopicRow[] = [];
  for (const entry of data) {
    if (rows.length >= MAX_EXTRACT) break;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const term = str(record.term);
    if (term === '') continue;
    rows.push({ term, count: int(record.count) });
  }
  return rows;
}

/**
 * `::hn-topics{data=... max=10}` — a badge cloud of recurring terms bound
 * to an array of {term, count}, sorted by count (verifiably by term on
 * ties). The top quartile of the rendered rows gets the largest badge
 * size down to the smallest; the count rides along under each term.
 * Unbound or failed bindings render nothing but the container with a
 * tooltip, per spec §4's quiet presentation.
 */
export function HnTopics({
  attributes,
  data,
  dataStatus,
  dataError,
}: MarkComponentProps): ReactElement {
  const bound = safeExtract<TopicRow[]>(
    () => (isUnreadable(dataStatus) ? [] : extractTopics(data)),
    () => [],
  );

  const max = Math.min(Math.max(int(attributes.max, 10), 1), 20);
  const rows = [...bound.fields]
    .sort((a, b) => b.count - a.count || (a.term < b.term ? -1 : 1))
    .slice(0, max);

  return (
    <div
      className={stateClassName('mk-hn-topics', dataStatus)}
      title={failureTitle(dataError, bound.fault)}
    >
      {rows.map((row, index) => {
        const level =
          LEVEL_COUNT -
          Math.min(Math.floor((index * LEVEL_COUNT) / Math.max(rows.length, 1)), LEVEL_COUNT - 1);
        return (
          <span
            key={index}
            className={`mk-hn-topics__term mk-hn-topics__term--${level}`}
          >
            {row.term}
            <span className="mk-hn-topics__count">{row.count}</span>
          </span>
        );
      })}
    </div>
  );
}