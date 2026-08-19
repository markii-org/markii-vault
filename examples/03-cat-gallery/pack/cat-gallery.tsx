import type { ReactElement } from 'react';
import type { MarkComponentProps } from '@markii/react';
import { failureTitle, int, isUnreadable, safeExtract, stateClassName, str } from './guard';

const MAX_EXTRACT = 30;

interface Photo {
  url: string;
  breed: string;
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
function extractPhotos(data: unknown): Photo[] {
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
      width: int(record.width),
      height: int(record.height),
    });
  }
  return photos;
}

/**
 * `::cat-gallery{data=... max=8}` — a responsive photo grid bound to an
 * array of {url, breed, width, height}. Tiles keep a uniform 4:3 crop and
 * caption each photo with its breed (or "mystery cat" when the API had no
 * breed data) and pixel dimensions. Unbound or failed bindings render an
 * empty grid with only a tooltip, per spec §4's quiet presentation.
 */
export function CatGallery({
  attributes,
  data,
  dataStatus,
  dataError,
}: MarkComponentProps): ReactElement {
  const bound = safeExtract<Photo[]>(
    () => (isUnreadable(dataStatus) ? [] : extractPhotos(data)),
    () => [],
  );

  const max = Math.min(Math.max(int(attributes.max, 8), 1), 30);
  const photos = bound.fields.slice(0, max);

  return (
    <div
      className={stateClassName('mk-cat-gallery', dataStatus)}
      title={failureTitle(dataError, bound.fault)}
    >
      {photos.map((photo, index) => (
        <figure key={index} className="mk-cat-figure">
          <img
            className="mk-cat-figure__photo"
            src={photo.url}
            alt={photo.breed || `cat photo ${index + 1}`}
            loading="lazy"
          />
          <figcaption className="mk-cat-figure__caption">
            {photo.breed || 'mystery cat'}
            {photo.width > 0 && photo.height > 0
              ? ` · ${photo.width}×${photo.height} px`
              : ''}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}