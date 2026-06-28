import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Trash2, MoreHorizontal, Pencil, AlignLeft, ListOrdered, Check, Share2, ClipboardList, Tv, X } from 'lucide-react';
import { Menu, Button } from '@mantine/core';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { itemKey, type Collection, type CollectionItem } from '../../hooks/useCollections';
import { POSTER_GRID, type PosterSize } from '../../hooks/usePosterSize';
import { PosterSizeControl } from './PosterSizeControl';
import { ShareListModal } from './ShareListModal';

interface CollectionDetailProps {
  collection: Collection;
  items: CollectionItem[]; // in collection order
  onBack: () => void;
  onOpenItem: (item: CollectionItem) => void;
  onRemoveItem: (key: string) => void;
  onReorder: (keys: string[]) => void;
  onToggleRanked: (ranked: boolean) => void;
  onRename: (name: string) => void;
  onSetDescription: (description: string) => void;
  onDelete: () => void;
  onAddTitles: () => void;
  size: PosterSize;
  onSizeChange: (size: PosterSize) => void;
}

/** Captionless poster tile: art only, rank badge (ranked), title on hover, remove on hover. */
function DetailTile({
  item,
  rank,
  onOpen,
  onRemove,
}: {
  item: CollectionItem;
  rank?: number;
  onOpen: (i: CollectionItem) => void;
  onRemove?: (key: string) => void;
}) {
  return (
    <div className="group relative">
      <button type="button" onClick={() => onOpen(item)} className="block w-full text-left">
        <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-[rgb(var(--color-bg-elevated))]">
          {item.posterUrl ? (
            <img src={item.posterUrl} alt={item.title} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Tv className="w-7 h-7 text-[rgb(var(--color-text-tertiary))]" />
            </div>
          )}
          {/* Title revealed on hover/focus */}
          <div className="absolute inset-0 flex items-end p-2 bg-gradient-to-t from-black/85 via-black/15 to-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
            <span className="text-xs font-medium text-white leading-tight line-clamp-2">{item.title}</span>
          </div>
        </div>
      </button>
      {rank !== undefined && (
        <span className="absolute top-1.5 left-1.5 min-w-[22px] h-[22px] px-1 inline-flex items-center justify-center rounded-md bg-black/65 text-white text-xs font-semibold tabular-nums">
          {rank}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label="Remove from list"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(itemKey(item));
          }}
          className="absolute top-1.5 right-1.5 w-6 h-6 inline-flex items-center justify-center rounded-md bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/75"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

function SortableItem({
  item,
  rank,
  onOpen,
  onRemove,
}: {
  item: CollectionItem;
  rank: number;
  onOpen: (i: CollectionItem) => void;
  onRemove: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: itemKey(item) });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition || undefined,
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
      }}
      {...attributes}
      {...listeners}
    >
      <DetailTile item={item} rank={rank} onOpen={onOpen} onRemove={onRemove} />
    </div>
  );
}

export function CollectionDetail({
  collection,
  items,
  onBack,
  onOpenItem,
  onRemoveItem,
  onReorder,
  onToggleRanked,
  onRename,
  onSetDescription,
  onDelete,
  onAddTitles,
  size,
  onSizeChange,
}: CollectionDetailProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const gridClass = POSTER_GRID[size];
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Slideshow of the list's posters as the blurred banner backdrop.
  const heroPosters = items.map((i) => i.posterUrl).filter((u): u is string => !!u).slice(0, 8);
  const [bgIndex, setBgIndex] = useState(0);
  useEffect(() => {
    if (heroPosters.length <= 1) return;
    const id = setInterval(() => setBgIndex((i) => (i + 1) % heroPosters.length), 4500);
    return () => clearInterval(id);
  }, [heroPosters.length]);
  const activeIndex = heroPosters.length ? bgIndex % heroPosters.length : 0;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const keys = items.map(itemKey);
    const oldIndex = keys.indexOf(active.id as string);
    const newIndex = keys.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(keys, oldIndex, newIndex));
  };

  const handleRename = () => {
    const next = window.prompt('Rename list', collection.name);
    if (next && next.trim()) onRename(next.trim());
  };

  const handleEditDescription = () => {
    const next = window.prompt('Description', collection.description ?? '');
    if (next !== null) onSetDescription(next);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${collection.name}"? This only removes the list, not the titles from your library.`)) {
      onDelete();
    }
  };

  // Copy the list as a plain-text, paste-anywhere version (titles only).
  const handleCopyText = async () => {
    const lines = [collection.name];
    if (collection.description) lines.push(collection.description);
    lines.push('');
    items.forEach((it, i) => {
      lines.push(`${collection.ranked ? `${i + 1}. ` : '• '}${it.title}`);
    });
    lines.push('', 'made on ShowShowShow · showshowshow.app');
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('List copied as text');
    } catch {
      toast.error('Could not copy text');
    }
  };

  return (
    <div>
      {/* Cinematic banner — full-bleed, slideshow of the list's posters */}
      <div className="relative overflow-hidden -mt-8 -mx-4 md:-mx-6 lg:-mx-8 mb-5" style={{ background: '#15161a' }}>
        {heroPosters.map((url, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
            style={{
              backgroundImage: `url(${url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(44px) brightness(0.7)',
              transform: 'scale(1.18)',
              opacity: i === activeIndex ? 1 : 0,
            }}
          />
        ))}
        {/* Same gradient recipe as the content modal: left-dark for the title +
            a vertical fade into the page background so the banner melts into the grid. */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgb(var(--color-bg-page))] via-black/45 to-black/25" />
        <div className="relative z-10 flex flex-col justify-between gap-10 px-4 md:px-6 lg:px-8 pt-8 pb-6 min-h-[220px]">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-sm font-medium text-white/90 hover:text-white transition-colors"
              style={{ textShadow: '0 1px 8px rgba(0,0,0,.5)' }}
            >
              <ArrowLeft size={15} />
              Lists
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onAddTitles}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 text-white text-sm font-medium hover:bg-white/25 transition-colors"
              >
                <Plus size={15} />
                Add titles
              </button>
              <Menu shadow="sm" width={210} position="bottom-end">
                <Menu.Target>
                  <button
                    type="button"
                    aria-label="List options"
                    className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-white bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <MoreHorizontal size={20} />
                  </button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<Pencil size={15} />} onClick={handleRename}>
                    Rename
                  </Menu.Item>
                  <Menu.Item leftSection={<AlignLeft size={15} />} onClick={handleEditDescription}>
                    {collection.description ? 'Edit description' : 'Add description'}
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<ListOrdered size={15} />}
                    rightSection={collection.ranked ? <Check size={14} /> : null}
                    onClick={() => onToggleRanked(!collection.ranked)}
                  >
                    Ranked
                  </Menu.Item>
                  <Menu.Item leftSection={<Share2 size={15} />} onClick={() => setShareOpen(true)} disabled={items.length === 0}>
                    Share as image…
                  </Menu.Item>
                  <Menu.Item leftSection={<ClipboardList size={15} />} onClick={handleCopyText} disabled={items.length === 0}>
                    Copy as text
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item color="red" leftSection={<Trash2 size={15} />} onClick={handleDelete}>
                    Delete list
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </div>
          </div>

          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">{collection.name}</h2>
            {collection.description && (
              <p className="text-sm text-white/75 mt-1.5 max-w-2xl line-clamp-2">{collection.description}</p>
            )}
            <p className="text-sm text-white/55 mt-2">
              {items.length} {items.length === 1 ? 'title' : 'titles'}
              {collection.ranked ? ' · ranked' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      {items.length === 0 ? (
        <div className="bg-[rgb(var(--color-bg-surface))] rounded-lg p-12 text-center border border-[rgb(var(--color-border-default))]">
          <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-4">This list is empty.</p>
          <Button className="bg-[rgb(var(--color-accent))] text-white hover:opacity-80" leftSection={<Plus size={16} />} onClick={onAddTitles}>
            Add titles
          </Button>
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-3">
            <PosterSizeControl value={size} onChange={onSizeChange} />
          </div>
          {collection.ranked ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map(itemKey)} strategy={rectSortingStrategy}>
                <div className={gridClass}>
                  {items.map((item, idx) => (
                    <SortableItem key={itemKey(item)} item={item} rank={idx + 1} onOpen={onOpenItem} onRemove={onRemoveItem} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className={gridClass}>
              {items.map((item) => (
                <DetailTile key={itemKey(item)} item={item} onOpen={onOpenItem} onRemove={onRemoveItem} />
              ))}
            </div>
          )}
        </>
      )}

      <ShareListModal opened={shareOpen} onClose={() => setShareOpen(false)} collection={collection} items={items} />
    </div>
  );
}
