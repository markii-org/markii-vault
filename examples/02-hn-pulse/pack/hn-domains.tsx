import type { ReactElement } from 'react';
import type { MarkComponentProps } from '@markii/react';
import { failureTitle, int, isUnreadable, safeExtract, stateClassName, str } from './guard';

const MAX_EXTRACT = 100;
const VALUE_KEYS = ['count', 'points'] as const;
type ValueKey = (typeof VALUE_KEYS)[number];

interface DomainRow {
  domain: string;
  count: number;
  points: number;
}

function extractDomains(data: unknown): DomainRow[] {
  if (!Array.isArray(data)) return [];
  const rows: DomainRow[] = [];
  for (const entry of data) {
    if (rows.length >= MAX_EXTRACT) break;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const domain = str(record.domain);
    if (domain === '') continue;
    rows.push({
      domain,
      count: int(record.count),
      points: int(record.points),
    });
  }
  return rows;
}

/**
 * `::hn-domains{data=... max=6 value=count}` — a horizontal bar
 * leaderboard of domains bound to an array of {domain, count, points}.
 * Bars are scaled to the `value=` key (`count` by default, or `points`)
 * of the top row; each row shows the domain, its bar, and "count · points
 * pts". Unbound or failed bindings render an empty list with only a
 * tooltip, per spec §4's quiet presentation.
 */
export function HnDomains({
  attributes,
  data,
  dataStatus,
  dataError,
}: MarkComponentProps): ReactElement {
  const bound = safeExtract<DomainRow[]>(
    () => (isUnreadable(dataStatus) ? [] : extractDomains(data)),
    () => [],
  );

  const rawValue = str(attributes.value, 'count');
  const valueKey: ValueKey = (VALUE_KEYS as readonly string[]).includes(rawValue)
    ? (rawValue as ValueKey)
    : 'count';
  const max = Math.min(Math.max(int(attributes.max, 8), 1), 15);

  const sorted = [...bound.fields].sort(
    (a, b) => b[valueKey] - a[valueKey],
  );
  const rows = sorted.slice(0, max);
  const scale = Math.max(rows[0]?.[valueKey] ?? 0, 1);

  return (
    <ol
      className={stateClassName('mk-hn-domains', dataStatus)}
      title={failureTitle(dataError, bound.fault)}
    >
      {rows.map((row, index) => (
        <li key={index} className="mk-hn-domains__row">
          <span className="mk-hn-domains__name">{row.domain}</span>
          <span className="mk-hn-domains__track">
            <span
              className="mk-hn-domains__bar"
              style={{ width: `${Math.round((row[valueKey] / scale) * 100)}%` }}
            />
          </span>
          <span className="mk-hn-domains__value">
            {row.count} · {row.points} pts
          </span>
        </li>
      ))}
    </ol>
  );
}