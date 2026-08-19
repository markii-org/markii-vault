import type { ReactElement } from 'react';
import type { MarkComponentProps } from '@markii/react';
import { failureTitle, int, isUnreadable, safeExtract, stateClassName, str } from './guard';

const MAX_EXTRACT = 1000;
const DEFAULT_HOURS = 24;
const HOUR_SEC = 3600;

/**
 * Collects unix-second timestamps off a bound array: plain numbers, or
 * objects carrying `created_at_i` (the story shape the `pulse` script
 * returns). Only finite positive numbers survive; everything else drops.
 */
function extractTimestamps(data: unknown): number[] {
  if (!Array.isArray(data)) return [];
  const out: number[] = [];
  for (const entry of data) {
    if (out.length >= MAX_EXTRACT) break;
    if (typeof entry === 'number') {
      if (Number.isFinite(entry) && entry > 0) out.push(entry);
      continue;
    }
    if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
      const ts = int((entry as Record<string, unknown>).created_at_i);
      if (ts > 0) out.push(ts);
    }
  }
  return out;
}

/**
 * `::hn-activity{data=... hours=24}` — an hourly histogram of threads
 * started, bound to an array of story objects (or raw unix seconds). The
 * sandbox has no clock, so the "last N hours" window is drawn here in host
 * JS (docs/scripting.md — presentation is the component's business):
 * timestamps are binned into whole hours, anything older than the `hours=`
 * window (or in the future) is dropped, and leading empty hours on the old
 * side are trimmed so the chart spans exactly the data the script actually
 * retrieved. Each bar carries the hour it depicts as a tooltip; the
 * container itself mirrors the reference components' quiet failure
 * presentation.
 */
export function HnActivity({
  attributes,
  data,
  dataStatus,
  dataError,
}: MarkComponentProps): ReactElement {
  const bound = safeExtract<number[]>(
    () => (isUnreadable(dataStatus) ? [] : extractTimestamps(data)),
    () => [],
  );

  const hours = Math.min(Math.max(int(attributes.hours, DEFAULT_HOURS), 1), 48);
  const nowSec = Date.now() / 1000;

  const counts: number[] = new Array(hours).fill(0);
  let maxCount = 0;
  let newestBucket = -1;
  let oldestBucket = -1;
  for (const ts of bound.fields) {
    const bucket = Math.floor((nowSec - ts) / HOUR_SEC);
    if (bucket < 0 || bucket >= hours) continue;
    counts[bucket] = (counts[bucket] ?? 0) + 1;
    if ((counts[bucket] ?? 0) > maxCount) maxCount = counts[bucket] ?? 0;
    if (newestBucket === -1 || bucket < newestBucket) newestBucket = bucket;
    if (oldestBucket === -1 || bucket > oldestBucket) oldestBucket = bucket;
  }

  const hasData = newestBucket !== -1;
  const bars: ReactElement[] = [];
  if (hasData) {
    for (let bucket = oldestBucket; bucket >= newestBucket; bucket -= 1) {
      const count = counts[bucket] ?? 0;
      const height =
        count > 0 ? `${Math.max(Math.round((count / Math.max(maxCount, 1)) * 100), 6)}%` : '2px';
      const at = new Date((nowSec - bucket * HOUR_SEC) * 1000);
      bars.push(
        <span
          key={bucket}
          className="mk-hn-activity__bar"
          style={{ height }}
          title={`${at.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })} — ${count} thread${count === 1 ? '' : 's'}`}
        />,
      );
    }
  }

  const summary = hasData
    ? `${bars.length} hourly bucket${bars.length === 1 ? '' : 's'}, ${
        counts[newestBucket] ?? 0
      } to ${counts[oldestBucket] ?? 0} threads`
    : 'no recent stories recorded';

  return (
    <div
      className={stateClassName('mk-hn-activity', dataStatus)}
      title={failureTitle(dataError, bound.fault)}
      role="img"
      aria-label={summary}
    >
      {bars}
    </div>
  );
}