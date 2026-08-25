import type { ReactElement } from 'react';
import type { MarkComponentProps } from '@markii/react';
import { failureTitle, int, isUnreadable, safeExtract, stateClassName, str } from './guard';
import './hn-list.css';

const MAX_EXTRACT = 1000;

const SORT_KEYS = ['points', 'comments', 'velocity'] as const;
type SortKey = (typeof SORT_KEYS)[number];

/**
 * A thread younger than this (10 minutes) has no meaningful per-hour rate:
 * dividing a 3-minute-old thread's comments by its age would report a
 * velocity of 20/hr for what is really one enthusiastic commenter.
 */
const MIN_AGE_HOURS = 1 / 6;

interface Row {
  title: string;
  href: string | undefined;
  domain: string;
  points: number;
  comments: number;
  createdAt: number;
}

/**
 * Extracts plain rows off a bound array. Only strings and finite numbers
 * ever leave this function (guard.ts's safeExtract wraps the whole walk),
 * so nothing hostile escapes into the DOM. Entries that are not plain
 * objects are skipped; malformed fields degrade to their neutral value.
 */
function extractRows(data: unknown): Row[] {
  if (!Array.isArray(data)) return [];
  const rows: Row[] = [];
  for (const entry of data) {
    if (rows.length >= MAX_EXTRACT) break;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const rawUrl = str(record.url);
    const href = /^https?:\/\//.test(rawUrl) ? rawUrl : undefined;
    rows.push({
      title: str(record.title, 'untitled'),
      href,
      domain: str(record.domain, 'self'),
      points: int(record.points),
      comments: int(record.comments),
      createdAt: int(record.created_at_i),
    });
  }
  return rows;
}

/** A story's age in hours, or 0 for a missing/future timestamp. */
function ageHours(createdAt: number, nowSec: number): number {
  const age = nowSec - createdAt;
  return Number.isFinite(age) && age > 0 ? age / 3600 : 0;
}

/**
 * Comments per hour since posting. The sandbox has no clock, so the raw
 * timestamps the script returned are turned into a rate here, in host JS
 * (docs/scripting.md — scripts are data providers, presentation is the
 * component's). A story with no comments or a missing timestamp has rate 0;
 * the 10-minute floor keeps a just-posted thread from claiming infinite
 * velocity.
 */
function velocity(createdAt: number, comments: number, nowSec: number): number {
  if (comments <= 0) return 0;
  return comments / Math.max(ageHours(createdAt, nowSec), MIN_AGE_HOURS);
}

function keyOf(row: Row, key: SortKey, nowSec: number): number {
  switch (key) {
    case 'comments':
      return row.comments;
    case 'velocity':
      return velocity(row.createdAt, row.comments, nowSec);
    default:
      return row.points;
  }
}

function sortRows(rows: Row[], key: SortKey, nowSec: number): Row[] {
  const sorted = [...rows];
  sorted.sort((a, b) => keyOf(b, key, nowSec) - keyOf(a, key, nowSec));
  return sorted;
}

/**
 * `::hn-list{data=... max=8 by=velocity}` — a ranked leaderboard of
 * Hacker News stories bound to an array of story objects ({title, url,
 * domain, points, comments, created_at_i}). Rows are sorted by the `by=`
 * key — `points` (default), `comments`, or `velocity` (comments per hour
 * since posting, computed at render time) — capped by `max=`, and each row
 * shows its rank, linked title, domain, and a points/comments meta line.
 *
 * Unbound or failed bindings render an empty list with the failure
 * presented as a tooltip only (guard.ts / spec §4), never body text. The
 * rank shown is the row's position in the rendered list, so it always
 * matches the visual order.
 */
export function HnList({
  attributes,
  data,
  dataStatus,
  dataError,
}: MarkComponentProps): ReactElement {
  const bound = safeExtract<Row[]>(
    () => (isUnreadable(dataStatus) ? [] : extractRows(data)),
    () => [],
  );

  const rawBy = str(attributes.by, 'points');
  const by: SortKey = (SORT_KEYS as readonly string[]).includes(rawBy)
    ? (rawBy as SortKey)
    : 'points';
  const max = Math.min(Math.max(int(attributes.max, 10), 1), 30);
  const showVelocity = by === 'velocity';

  const nowSec = Date.now() / 1000;
  const rows = sortRows(bound.fields, by, nowSec).slice(0, max);

  return (
    <ol
      className={stateClassName('mk-hn-list', dataStatus)}
      title={failureTitle(dataError, bound.fault)}
    >
      {rows.map((row, index) => (
        <li key={index} className="mk-hn-list__row">
          <span className="mk-hn-list__rank">{index + 1}</span>
          <span className="mk-hn-list__titles">
            {row.href !== undefined ? (
              <a
                className="mk-hn-list__title"
                href={row.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {row.title}
              </a>
            ) : (
              <span className="mk-hn-list__title">{row.title}</span>
            )}
            <span className="mk-hn-list__domain">{row.domain}</span>
          </span>
          <span className="mk-hn-list__meta">
            {row.points} pts · {row.comments} comments
            {showVelocity
              ? ` · ${velocity(row.createdAt, row.comments, nowSec).toFixed(1)}/hr`
              : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}