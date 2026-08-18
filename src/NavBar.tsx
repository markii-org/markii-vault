import { useEffect } from 'react';
import type { ReactElement } from 'react';
import type { ExampleDoc } from './examples';

interface NavBarProps {
  examples: ExampleDoc[];
  index: number;
  onNavigate: (index: number) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const { tagName } = target;
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    target.isContentEditable
  );
}

/**
 * The vault's example switcher: prev/next buttons + a compact dropdown, with
 * `[n / m]` position readout. Keyboard: left/right arrows move between
 * examples unless focus is inside the editor or another form control.
 */
export function NavBar({ examples, index, onNavigate }: NavBarProps): ReactElement {
  const count = examples.length;
  const isFirst = index === 0;
  const isLast = index === count - 1;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;
      if (event.key === 'ArrowLeft' && !isFirst) {
        event.preventDefault();
        onNavigate(index - 1);
      } else if (event.key === 'ArrowRight' && !isLast) {
        event.preventDefault();
        onNavigate(index + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, isFirst, isLast, onNavigate]);

  return (
    <nav className="playground__nav" aria-label="Example navigation">
      <button
        type="button"
        className="playground__button playground__button--ghost playground__nav-button"
        onClick={() => onNavigate(index - 1)}
        disabled={isFirst}
        aria-label="Previous example"
      >
        ‹ Prev
      </button>
      <span className="playground__nav-position">
        {index + 1} / {count}
      </span>
      <select
        className="playground__nav-select"
        value={examples[index]?.slug ?? ''}
        onChange={(event) => {
          const next = examples.findIndex((doc) => doc.slug === event.target.value);
          if (next !== -1) onNavigate(next);
        }}
        aria-label="Jump to example"
      >
        {examples.map((doc) => (
          <option key={doc.slug} value={doc.slug}>
            {doc.title}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="playground__button playground__button--ghost playground__nav-button"
        onClick={() => onNavigate(index + 1)}
        disabled={isLast}
        aria-label="Next example"
      >
        Next ›
      </button>
    </nav>
  );
}