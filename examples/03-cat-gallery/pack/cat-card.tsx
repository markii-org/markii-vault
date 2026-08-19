import type { ReactElement } from 'react';
import type { MarkComponentProps } from '@markii/react';
import { failureTitle, int, isUnreadable, safeExtract, stateClassName, str } from './guard';

interface FeaturedCat {
  url: string;
  breed: string;
  origin: string;
  temperament: string;
  wikipedia: string | undefined;
  width: number;
  height: number;
}

/**
 * Extracts one photo record off a bound value. Only primitives leave this
 * function (the whole walk runs inside guard.ts's safeExtract); a value
 * that is not a plain object, or whose url is not https, degrades to
 * "no featured cat" — the same quiet empty state a missing binding has.
 */
function extractCat(data: unknown): FeaturedCat | undefined {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  const rawUrl = str(record.url);
  if (!/^https:\/\//.test(rawUrl)) return undefined;
  const wikipedia = str(record.wikipedia);
  return {
    url: rawUrl,
    breed: str(record.breed),
    origin: str(record.origin),
    temperament: str(record.temperament),
    wikipedia: /^https?:\/\//.test(wikipedia) ? wikipedia : undefined,
    width: int(record.width),
    height: int(record.height),
  };
}

/**
 * `::cat-card{data=...}` — a featured-photo hero for a single cat bound to
 * {url, breed, origin, temperament, wikipedia, width, height}. The photo
 * fills the whole card; its profile — breed, origin and dimensions,
 * temperament, a Wikipedia link when the API provided one — sits in a
 * translucent scrim over the photo's lower edge, so the picture, not the
 * label, owns the space. Unbound or failed bindings render an empty figure
 * with only a tooltip, per spec §4's quiet presentation.
 */
export function CatCard({
  data,
  dataStatus,
  dataError,
}: MarkComponentProps): ReactElement {
  const bound = safeExtract<FeaturedCat | undefined>(
    () => (isUnreadable(dataStatus) ? undefined : extractCat(data)),
    () => undefined,
  );
  const cat = bound.fields;

  return (
    <figure
      className={stateClassName('mk-cat-card', dataStatus)}
      title={failureTitle(dataError, bound.fault)}
    >
      {cat !== undefined && (
        <>
          <img
            className="mk-cat-card__photo"
            src={cat.url}
            alt={cat.breed || 'cat photo'}
            loading="lazy"
          />
          <figcaption className="mk-cat-card__info">
            <span className="mk-cat-card__breed">
              {cat.breed || 'Mystery cat'}
            </span>
            {(cat.origin !== '' || cat.width > 0) && (
              <span className="mk-cat-card__meta">
                {cat.origin !== '' ? `${cat.origin} · ` : ''}
                {cat.width > 0 && cat.height > 0
                  ? `${cat.width}×${cat.height} px`
                  : ''}
              </span>
            )}
            {cat.temperament !== '' && (
              <p className="mk-cat-card__temperament">{cat.temperament}</p>
            )}
            {cat.wikipedia !== undefined && (
              <a
                className="mk-cat-card__link"
                href={cat.wikipedia}
                target="_blank"
                rel="noopener noreferrer"
              >
                Breed card on Wikipedia
              </a>
            )}
          </figcaption>
        </>
      )}
    </figure>
  );
}