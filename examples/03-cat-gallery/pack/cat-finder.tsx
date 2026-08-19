import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { MarkComponentProps } from '@markii/react';
import { failureTitle, int, isUnreadable, safeExtract, stateClassName, str } from './guard';

const MAX_EXTRACT = 30;

export interface Photo {
  url: string;
  breed: string;
  origin: string;
  temperament: string;
  wikipedia: string | undefined;
  width: number;
  height: number;
}

/**
 * Extracts plain photo records off a bound array. Only strings and finite
 * numbers ever leave this function (guard.ts's safeExtract wraps the whole
 * walk), so nothing hostile escapes into `src`/`alt`. A photo without an
 * https url is dropped outright — the Cat API serves everything over https,
 * and an unhandled scheme should never reach an `<img>`.
 */
export function extractPhotos(data: unknown): Photo[] {
  if (!Array.isArray(data)) return [];
  const photos: Photo[] = [];
  for (const entry of data) {
    if (photos.length >= MAX_EXTRACT) break;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const rawUrl = str(record.url);
    if (!/^https:\/\//.test(rawUrl)) continue;
    photos.push({
      url: rawUrl,
      breed: str(record.breed),
      origin: str(record.origin),
      temperament: str(record.temperament),
      wikipedia: /^https?:\/\//.test(str(record.wikipedia))
        ? str(record.wikipedia)
        : undefined,
      width: int(record.width),
      height: int(record.height),
    });
  }
  return photos;
}

interface Meet {
  breed: string;
  origin: string;
  temperament: string;
  wikipedia: string | undefined;
  photos: Photo[];
}

/**
 * Groups extracted photos by breed name into "meet" records for the chip
 * row. Runs inside safeExtract, so a hostile bound value can only produce
 * an empty wall, never a throw.
 */
function buildMeets(photos: Photo[]): Meet[] {
  const byBreed = new Map<string, Meet>();
  for (const photo of photos) {
    const key = photo.breed !== '' ? photo.breed : 'Mystery cat';
    const meet = byBreed.get(key);
    if (meet !== undefined) {
      meet.photos.push(photo);
    } else {
      byBreed.set(key, {
        breed: key,
        origin: photo.origin,
        temperament: photo.temperament,
        wikipedia: photo.wikipedia,
        photos: [photo],
      });
    }
  }
  return [...byBreed.values()].sort((a, b) => a.breed.localeCompare(b.breed));
}

/**
 * `::cat-finder{data=...}` — an interactive breed browser bound to the
 * photo array the note's script produces. A chip row shows every breed
 * present in the data; picking one narrows the wall below to that breed's
 * photos and opens a profile strip (origin, temperament, Wikipedia link).
 * The whole component is plain React state on top of the pack's guarded
 * extraction — chip labels are derived from the data, never from the
 * markup, so an unbound or failed binding shows the chips-less quiet
 * empty state per spec §4.
 */
export function CatFinder({
  data,
  dataStatus,
  dataError,
}: MarkComponentProps): ReactElement {
  const [pick, setPick] = useState('');

  const bound = safeExtract<Meet[]>(
    () =>
      isUnreadable(dataStatus) ? [] : buildMeets(extractPhotos(data)),
    () => [],
  );
  const meets = bound.fields;

  const active = pick !== '' ? meets.find((meet) => meet.breed === pick) : undefined;
  const shown = active !== undefined ? active.photos : meets.flatMap((meet) => meet.photos);

  return (
    <div
      className={stateClassName('mk-cat-finder', dataStatus)}
      title={failureTitle(dataError, bound.fault)}
    >
      {meets.length > 0 && (
        <>
          <div className="mk-cat-finder__chips" role="group" aria-label="Filter by breed">
            <button
              className={`mk-cat-finder__chip${pick === '' ? ' mk-cat-finder__chip--active' : ''}`}
              type="button"
              aria-pressed={pick === ''}
              onClick={() => setPick('')}
            >
              All breeds
            </button>
            {meets.map((meet) => (
              <button
                key={meet.breed}
                className={`mk-cat-finder__chip${pick === meet.breed ? ' mk-cat-finder__chip--active' : ''}`}
                type="button"
                aria-pressed={pick === meet.breed}
                onClick={() => setPick(meet.breed)}
              >
                {meet.breed}
                <span className="mk-cat-finder__count">{meet.photos.length}</span>
              </button>
            ))}
          </div>

          {active !== undefined && (
            <div className="mk-cat-finder__profile">
              {active.origin !== '' && (
                <span className="mk-cat-finder__origin">
                  {active.origin} · {active.photos.length}{' '}
                  {active.photos.length === 1 ? 'photo' : 'photos'}
                </span>
              )}
              {active.temperament !== '' && (
                <p className="mk-cat-finder__temperament">{active.temperament}</p>
              )}
              {active.wikipedia !== undefined && (
                <a
                  className="mk-cat-finder__link"
                  href={active.wikipedia}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Breed card on Wikipedia
                </a>
              )}
            </div>
          )}

          <div className="mk-cat-finder__grid">
            {shown.map((photo, index) => (
              <figure key={`${photo.breed}-${index}`} className="mk-cat-figure">
                <img
                  className="mk-cat-figure__photo"
                  src={photo.url}
                  alt={photo.breed || `cat photo ${index + 1}`}
                  loading="lazy"
                />
                <figcaption className="mk-cat-figure__caption">
                  {photo.breed || 'mystery cat'}
                  {photo.origin !== '' ? ` · from ${photo.origin}` : ''}
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
    </div>
  );
}