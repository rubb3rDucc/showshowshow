import { forwardRef } from 'react';
import type { LibraryItemUI } from '../../types/library.types';
import { BrandMark } from '../common/BrandMark';

export type ShareFormat = 'portrait' | 'square';
export type ShareTheme = 'quiet' | 'dark' | 'tinted';
export type ShareBackground = 'poster' | 'solid' | 'gradient';

export interface ShareCardOptions {
  theme: ShareTheme;
  accent: string;
  background: ShareBackground;
  showDescription: boolean;
  showRanks: boolean;
}

interface ListShareCardProps extends ShareCardOptions {
  name: string;
  description?: string;
  ranked: boolean;
  /** Curator line ("by …"); omitted when empty/undefined. */
  curator?: string;
  items: LibraryItemUI[];
  format: ShareFormat;
  /** Dominant poster color for the 'tinted' theme. */
  tint?: string;
}

// Fixed width for a consistent export resolution; height GROWS with the items
// so posters are never clipped or resized. `format` controls the column count.
const CONF: Record<ShareFormat, { w: number; pad: number; cols: number; title: number; gap: number }> = {
  portrait: { w: 1080, pad: 76, cols: 3, title: 78, gap: 22 },
  square: { w: 1080, pad: 64, cols: 4, title: 58, gap: 18 },
};

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Off-screen branded share card for a list. Fixed width, **auto height** (grows
 * with the items so posters are never cropped). Customizable: theme
 * (quiet/dark/tinted), accent, background (poster/solid/gradient), field toggles.
 * Posters use crossOrigin so the html-to-image export isn't tainted.
 */
export const ListShareCard = forwardRef<HTMLDivElement, ListShareCardProps>(function ListShareCard(
  { name, description, ranked, curator, items, format, theme, accent, background, showDescription, showRanks, tint },
  ref
) {
  const c = CONF[format];
  const backdrop = items.find((i) => i.content.posterUrl)?.content.posterUrl ?? null;

  const usePoster = background === 'poster' && !!backdrop;
  const lightText = usePoster || theme !== 'quiet';
  const fg = lightText ? '#fff' : '#1f2937';
  const sub = (op: number) => (lightText ? `rgba(255,255,255,${op})` : `rgba(31,41,55,${op})`);

  let rootBg = '#0c0d10';
  if (!usePoster) {
    if (background === 'gradient') {
      rootBg = lightText
        ? `linear-gradient(135deg, ${accent} -25%, #0a0a0c 78%)`
        : `linear-gradient(135deg, ${hexA(accent, 0.16)}, #f7f7f8 72%)`;
    } else {
      rootBg =
        theme === 'quiet'
          ? '#f7f7f8'
          : theme === 'tinted'
            ? `linear-gradient(160deg, ${tint || '#1f2937'} 0%, #0a0a0c 70%)`
            : '#0c0d10';
    }
  }

  const tileShadow = lightText ? '0 6px 20px rgba(0,0,0,.4)' : 'none';
  const tileBorder = lightText ? 'none' : '1px solid rgba(0,0,0,.08)';
  const tileBg = lightText ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)';

  return (
    <div
      ref={ref}
      style={{
        width: c.w,
        position: 'relative',
        overflow: 'hidden',
        background: rootBg,
        fontFamily: "'Nunito Sans', system-ui, sans-serif",
        color: fg,
        boxSizing: 'border-box',
      }}
    >
      {usePoster && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: -80,
              backgroundImage: `url(${backdrop})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(60px) brightness(0.55)',
              transform: 'scale(1.2)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(12,13,16,.55) 0%, rgba(12,13,16,.4) 45%, rgba(12,13,16,.92) 100%)',
            }}
          />
        </>
      )}

      <div style={{ position: 'relative', zIndex: 2, padding: c.pad }}>
        {/* Header */}
        <div style={{ fontSize: 34 }}>
          <BrandMark accent={accent} />
        </div>
        <div style={{ fontSize: c.title, fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.02em', marginTop: 18 }}>
          {name}
        </div>
        {curator && <div style={{ fontSize: 32, marginTop: 14, color: sub(0.8) }}>by {curator}</div>}
        {showDescription && description && (
          <div
            style={{
              fontSize: 30,
              marginTop: 14,
              color: sub(0.62),
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {description}
          </div>
        )}
        <div style={{ fontSize: 26, marginTop: 16, color: sub(0.5) }}>
          {items.length} {items.length === 1 ? 'title' : 'titles'}
          {ranked ? ' · ranked' : ''}
        </div>

        {/* Poster grid — grows with the items; posters keep their 2:3 aspect */}
        <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: `repeat(${c.cols}, 1fr)`, gap: c.gap }}>
          {items.map((item, i) => (
            <div
              key={item.contentId}
              style={{
                position: 'relative',
                aspectRatio: '2 / 3',
                borderRadius: 14,
                overflow: 'hidden',
                background: tileBg,
                boxShadow: tileShadow,
                border: tileBorder,
              }}
            >
              {item.content.posterUrl && (
                <img
                  src={item.content.posterUrl}
                  crossOrigin="anonymous"
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
              {ranked && showRanks && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    minWidth: 34,
                    height: 34,
                    padding: '0 8px',
                    borderRadius: 9,
                    background: hexA(accent, 0.92),
                    color: '#fff',
                    fontSize: 22,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {i + 1}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 36, fontSize: 26, color: sub(0.5) }}>
          made on <BrandMark accent={accent} /> · showshowshow.app
        </div>
      </div>
    </div>
  );
});
