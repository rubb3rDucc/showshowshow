import { Plus } from 'lucide-react';
import type { Collection } from '../../hooks/useCollections';
import { CollectionListCard } from './CollectionListCard';

interface CollectionsViewProps {
  collections: Collection[];
  onOpen: (id: string) => void;
  onNew: () => void;
}

/** Lists-tab overview: a single column of Letterboxd-style list rows. */
export function CollectionsView({ collections, onOpen, onNew }: CollectionsViewProps) {
  return (
    <div>
      {collections.length === 0 ? (
        <div className="bg-[rgb(var(--color-bg-surface))] rounded-lg p-12 text-center border border-[rgb(var(--color-border-default))]">
          <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-4">You haven't made any lists yet.</p>
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgb(var(--color-accent))] text-white text-sm font-medium hover:opacity-80"
          >
            <Plus size={16} />
            New list
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
          {collections.map((c) => (
            <CollectionListCard
              key={c.id}
              name={c.name}
              description={c.description}
              count={c.items.length}
              ranked={c.ranked}
              posters={c.items.map((i) => i.posterUrl)}
              onClick={() => onOpen(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
