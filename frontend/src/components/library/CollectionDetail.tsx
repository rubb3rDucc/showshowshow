import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Switch, Button } from '@mantine/core';
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
import type { Collection } from '../../hooks/useCollections';
import type { LibraryItemUI } from '../../types/library.types';
import { LibraryPosterCard } from './LibraryPosterCard';

interface CollectionDetailProps {
  collection: Collection;
  items: LibraryItemUI[]; // resolved, in collection order
  onBack: () => void;
  onOpenItem: (item: LibraryItemUI) => void;
  onRemoveItem: (contentId: string) => void;
  onReorder: (contentIds: string[]) => void;
  onToggleRanked: (ranked: boolean) => void;
  onRename: (name: string) => void;
  onSetDescription: (description: string) => void;
  onDelete: () => void;
  onAddTitles: () => void;
}

const GRID = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6';

function SortableItem({
  item,
  rank,
  onOpen,
  onRemove,
}: {
  item: LibraryItemUI;
  rank: number;
  onOpen: (i: LibraryItemUI) => void;
  onRemove: (contentId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.contentId });
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
      <LibraryPosterCard item={item} rank={rank} onOpen={onOpen} onRemove={onRemove} />
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
}: CollectionDetailProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = items.map((i) => i.contentId);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
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

  return (
    <div>
      {/* Sub-header */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 mb-3 text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
      >
        <ArrowLeft size={15} />
        Lists
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <button
            type="button"
            onClick={handleRename}
            title="Rename"
            className="text-xl md:text-2xl font-semibold tracking-tight text-[rgb(var(--color-text-primary))] hover:opacity-80 transition-opacity text-left"
          >
            {collection.name}
          </button>
          {collection.description && (
            <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1 max-w-2xl">
              {collection.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">
              {items.length} {items.length === 1 ? 'title' : 'titles'}
            </p>
            <span className="text-[rgb(var(--color-text-tertiary))]">·</span>
            <button
              type="button"
              onClick={handleEditDescription}
              className="text-sm text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-secondary))] transition-colors"
            >
              {collection.description ? 'Edit description' : 'Add description'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Switch
            label="Ranked"
            checked={collection.ranked}
            onChange={(e) => onToggleRanked(e.currentTarget.checked)}
            size="sm"
          />
          <Button
            size="sm"
            variant="light"
            color="gray"
            leftSection={<Trash2 size={15} />}
            onClick={handleDelete}
          >
            Delete
          </Button>
          <Button
            size="sm"
            className="bg-[rgb(var(--color-accent))] text-white hover:opacity-80"
            leftSection={<Plus size={15} />}
            onClick={onAddTitles}
          >
            Add titles
          </Button>
        </div>
      </div>

      {/* Body */}
      {items.length === 0 ? (
        <div className="bg-[rgb(var(--color-bg-surface))] rounded-lg p-12 text-center border border-[rgb(var(--color-border-default))]">
          <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-4">This list is empty.</p>
          <Button
            className="bg-[rgb(var(--color-accent))] text-white hover:opacity-80"
            leftSection={<Plus size={16} />}
            onClick={onAddTitles}
          >
            Add titles
          </Button>
        </div>
      ) : collection.ranked ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.contentId)} strategy={rectSortingStrategy}>
            <div className={GRID}>
              {items.map((item, idx) => (
                <SortableItem
                  key={item.contentId}
                  item={item}
                  rank={idx + 1}
                  onOpen={onOpenItem}
                  onRemove={onRemoveItem}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className={GRID}>
          {items.map((item) => (
            <LibraryPosterCard key={item.contentId} item={item} onOpen={onOpenItem} onRemove={onRemoveItem} />
          ))}
        </div>
      )}
    </div>
  );
}
