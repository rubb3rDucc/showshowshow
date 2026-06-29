import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, SegmentedControl, Button, Group, Loader, Switch, TextInput, Select } from '@mantine/core';
import { Download, Copy, Check } from 'lucide-react';
import { domToBlob } from 'modern-screenshot';
import { useUser } from '@clerk/clerk-react';
import { toast } from 'sonner';
import { ListShareCard, type ShareFormat, type ShareTheme, type ShareBackground } from './ListShareCard';
import type { Collection, CollectionItem } from '../../hooks/useCollections';

interface ShareListModalProps {
  opened: boolean;
  onClose: () => void;
  collection: Collection;
  items: CollectionItem[];
}

const PREVIEW_W = 300;
const ACCENTS = ['#646cff', '#f43f5e', '#f59e0b', '#10b981', '#0ea5e9', '#a855f7'];

// iPadOS reports as "Macintosh" but is touch-capable; cover both.
const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

/**
 * Fetch a (CORS-enabled) image and return it as a data URL. Inlining posters
 * before the export runs avoids the tainted-canvas bug on iOS Safari, where
 * remote TMDB images otherwise vanish from the exported PNG.
 */
async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' });
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

// Posters arrive from TMDB at w500+; the share-card tiles render ~270-360px
// wide, so request w342 — roughly half the bytes, much faster to fetch and
// base64-encode. Non-TMDB URLs pass through unchanged.
function compactPosterUrl(url: string): string {
  return url.replace(/\/t\/p\/(w\d+|original)\//, '/t/p/w342/');
}

export function ShareListModal({ opened, onClose, collection, items }: ShareListModalProps) {
  const { user } = useUser();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  const [format, setFormat] = useState<ShareFormat>('portrait');
  const [theme, setTheme] = useState<ShareTheme>('quiet');
  const [background, setBackground] = useState<ShareBackground>('solid');
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [showDescription, setShowDescription] = useState(true);
  const [showRanks, setShowRanks] = useState(true);
  const [showBranding, setShowBranding] = useState(true);
  const [showCount, setShowCount] = useState(true);
  const [showName, setShowName] = useState(true);
  const [limit, setLimit] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [tint, setTint] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const defaultName = user?.fullName || user?.firstName || user?.username || 'me';
  const curator = showName ? name.trim() || defaultName : undefined;
  const scale = PREVIEW_W / 1080;

  // The card grows with its items, so measure it to size the preview frame.
  // Measure via a CALLBACK REF so it fires exactly when the off-screen card
  // mounts — Mantine's Modal mounts content after a transition, so an [opened]
  // effect can run before the node exists (leaving the preview blank). A
  // ResizeObserver then tracks later poster reflow.
  const [cardH, setCardH] = useState(0);
  const setCardNode = useCallback((node: HTMLDivElement | null) => {
    cardRef.current = node;
    roRef.current?.disconnect();
    roRef.current = null;
    if (node) {
      const measure = () => setCardH(node.offsetHeight);
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(node);
      roRef.current = ro;
    }
  }, []);
  const slug = collection.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'list';

  // iOS Safari throws on clipboard image writes (the "request not allowed"
  // error), so Copy is desktop-only. The native share sheet was also dropped
  // (unreliable permissions on iOS); Download is the universal action.
  const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write && !IS_IOS;

  // Only the titles that will actually appear on the card (respecting `limit`)
  // need resolving — capping to "First 6" then fetches just 6 posters.
  const shownItems = useMemo(
    () => (limit && limit < items.length ? items.slice(0, limit) : items),
    [items, limit],
  );
  // Pre-resolve each shown poster to a data URL so the off-screen card renders
  // inlined images — required for a clean image export on iOS.
  const posterUrls = useMemo(
    () => Array.from(new Set(shownItems.map((i) => i.posterUrl).filter((u): u is string => !!u))),
    [shownItems],
  );
  const [posters, setPosters] = useState<Record<string, string>>({});
  const postersReady = posterUrls.every((u) => posters[u]);
  useEffect(() => {
    if (!opened) return;
    // Fetch only what's missing, then merge — raising the limit doesn't refetch
    // posters already resolved. (Effect re-runs after setPosters, then no-ops.)
    const missing = posterUrls.filter((u) => !posters[u]);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map(async (u) => {
        try {
          return [u, await toDataUrl(compactPosterUrl(u))] as const;
        } catch {
          return [u, u] as const; // fall back to the remote URL on fetch failure
        }
      }),
    ).then((pairs) => {
      if (!cancelled) setPosters((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      cancelled = true;
    };
  }, [opened, posterUrls, posters]);

  // Extract a dominant poster color for the 'tinted' theme (CORS-enabled).
  useEffect(() => {
    if (theme !== 'tinted' || tint) return;
    const url = items.find((i) => i.posterUrl)?.posterUrl;
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = 1;
        cv.height = 1;
        const ctx = cv.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        setTint(`rgb(${d[0]},${d[1]},${d[2]})`);
      } catch {
        /* ignore extraction failures */
      }
    };
    img.src = url;
  }, [theme, tint, items]);

  const render = async (): Promise<Blob | null> => {
    const node = cardRef.current;
    if (!node) return null;
    // modern-screenshot waits for images to decode before rasterizing, which
    // fixes the blank-posters-on-iOS bug the old html-to-image had (its SVG
    // foreignObject pass captured before Safari finished decoding the images).
    // Pass the node's natural size: it sits inside a `scale()` preview wrapper,
    // and without an explicit size the capture is taken from the scaled bounding
    // box and comes out cropped to the top-left corner. offsetWidth/Height are
    // layout dimensions, unaffected by the ancestor transform.
    // font: false skips web-font (Nunito Sans) download/embed — the single
    // biggest cost per export; the card's text falls back to system-ui.
    return domToBlob(node, { width: node.offsetWidth, height: node.offsetHeight, scale: 1, font: false });
  };

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not generate the image');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () =>
    withBusy(async () => {
      const blob = await render();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}-${format}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Image saved');
    });

  const handleCopy = () =>
    withBusy(async () => {
      const blob = await render();
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success('Image copied');
    });

  return (
    <Modal opened={opened} onClose={onClose} title="Share list" centered size="lg">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Controls */}
        <div className="md:w-64 space-y-3 order-2 md:order-1">
          <SegmentedControl
            fullWidth
            size="xs"
            value={format}
            onChange={(v) => setFormat(v as ShareFormat)}
            data={[
              { label: 'Portrait', value: 'portrait' },
              { label: 'Square', value: 'square' },
            ]}
          />
          <SegmentedControl
            fullWidth
            size="xs"
            value={theme}
            onChange={(v) => setTheme(v as ShareTheme)}
            data={[
              { label: 'Quiet', value: 'quiet' },
              { label: 'Dark', value: 'dark' },
              { label: 'Tinted', value: 'tinted' },
            ]}
          />
          <SegmentedControl
            fullWidth
            size="xs"
            value={background}
            onChange={(v) => setBackground(v as ShareBackground)}
            data={[
              { label: 'Solid', value: 'solid' },
              { label: 'Poster', value: 'poster' },
              { label: 'Gradient', value: 'gradient' },
            ]}
          />

          {items.length > 3 && (
            <Select
              size="xs"
              label="Titles shown"
              value={limit ? String(limit) : 'all'}
              onChange={(v) => setLimit(v && v !== 'all' ? Number(v) : null)}
              allowDeselect={false}
              data={[
                { value: 'all', label: `All (${items.length})` },
                ...[3, 6, 8, 10, 12, 15, 20, 30, 50]
                  .filter((n) => n < items.length)
                  .map((n) => ({ value: String(n), label: `First ${n}` })),
              ]}
            />
          )}

          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-[rgb(var(--color-text-secondary))]">Accent</span>
            {ACCENTS.map((col) => (
              <button
                key={col}
                type="button"
                aria-label={`Accent ${col}`}
                onClick={() => setAccent(col)}
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: col, outline: accent === col ? '2px solid rgba(0,0,0,.35)' : 'none', outlineOffset: 1 }}
              >
                {accent === col && <Check size={12} color="#fff" />}
              </button>
            ))}
          </div>

          <div className="space-y-2 pt-1">
            <Switch size="xs" label="Show description" checked={showDescription} onChange={(e) => setShowDescription(e.currentTarget.checked)} />
            {collection.ranked && (
              <Switch size="xs" label="Show numbers" checked={showRanks} onChange={(e) => setShowRanks(e.currentTarget.checked)} />
            )}
            <Switch size="xs" label="Show title count" checked={showCount} onChange={(e) => setShowCount(e.currentTarget.checked)} />
            <Switch size="xs" label="Show branding" checked={showBranding} onChange={(e) => setShowBranding(e.currentTarget.checked)} />
            <Switch size="xs" label="Show my name" checked={showName} onChange={(e) => setShowName(e.currentTarget.checked)} />
            {showName && (
              <TextInput
                size="xs"
                aria-label="Name on card"
                placeholder={defaultName}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
            )}
          </div>
        </div>

        {/* Preview + actions */}
        <div className="flex-1 flex flex-col items-center gap-4 order-1 md:order-2">
          <div
            style={{ width: PREVIEW_W, height: cardH * scale || 360, overflow: 'hidden', borderRadius: 12, position: 'relative' }}
            className="shadow-md ring-1 ring-black/5"
          >
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <ListShareCard
                ref={setCardNode}
                name={collection.name}
                description={collection.description}
                ranked={collection.ranked}
                curator={curator}
                items={items}
                format={format}
                theme={theme}
                accent={accent}
                background={background}
                showDescription={showDescription}
                showRanks={showRanks}
                showBranding={showBranding}
                showCount={showCount}
                limit={limit ?? undefined}
                tint={tint}
                posters={posters}
              />
            </div>
            {!postersReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-sm">
                <Loader size={20} />
                <span className="text-xs text-[rgb(var(--color-text-secondary))]">Preparing image…</span>
              </div>
            )}
          </div>

          <Group gap="sm" justify="center" className="w-full">
            <Button
              leftSection={busy || !postersReady ? <Loader size={14} /> : <Download size={15} />}
              onClick={handleDownload}
              disabled={busy || !postersReady}
              className="bg-[rgb(var(--color-accent))] text-white hover:opacity-80"
            >
              Download
            </Button>
            {canCopy && (
              <Button variant="light" color="gray" leftSection={<Copy size={15} />} onClick={handleCopy} disabled={busy || !postersReady}>
                Copy
              </Button>
            )}
          </Group>
        </div>
      </div>
    </Modal>
  );
}
