import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, SegmentedControl, Button, Group, Loader, Switch, TextInput } from '@mantine/core';
import { Download, Copy, Share2, Check } from 'lucide-react';
import { toBlob } from 'html-to-image';
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

  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare;
  const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;

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
    if (!cardRef.current) return null;
    return toBlob(cardRef.current, { cacheBust: true, pixelRatio: 1 });
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

  const handleShare = () =>
    withBusy(async () => {
      const blob = await render();
      if (!blob) return;
      const file = new File([blob], `${slug}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: collection.name });
      } else {
        toast.info('Sharing not supported here — try Download');
      }
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
            style={{ width: PREVIEW_W, height: cardH * scale, overflow: 'hidden', borderRadius: 12 }}
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
                tint={tint}
              />
            </div>
          </div>

          <Group gap="sm" justify="center" className="w-full">
            <Button
              leftSection={busy ? <Loader size={14} /> : <Download size={15} />}
              onClick={handleDownload}
              disabled={busy}
              className="bg-[rgb(var(--color-accent))] text-white hover:opacity-80"
            >
              Download
            </Button>
            {canCopy && (
              <Button variant="light" color="gray" leftSection={<Copy size={15} />} onClick={handleCopy} disabled={busy}>
                Copy
              </Button>
            )}
            {canShare && (
              <Button variant="light" color="gray" leftSection={<Share2 size={15} />} onClick={handleShare} disabled={busy}>
                Share
              </Button>
            )}
          </Group>
        </div>
      </div>
    </Modal>
  );
}
