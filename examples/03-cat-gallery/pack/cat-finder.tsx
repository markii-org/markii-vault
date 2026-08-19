import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { MarkComponentProps } from '@markii/react';
import { failureTitle, isUnreadable, safeExtract, stateClassName } from './guard';
import { extractPhotos } from './cat-gallery';
import type { Photo } from './cat-gallery';

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
 * same photo array the gallery uses. A chip row shows every breed present
 * in the data; picking one narrows the wall below to that breed's photos
 * and opens a profile strip (origin, temperament, Wikipedia link). The
 * whole component is plain React state on top of the pack's guarded
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