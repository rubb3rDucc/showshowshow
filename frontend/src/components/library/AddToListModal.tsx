import { useMemo, useState } from 'react';
import { Modal, TextInput, Button, Group, ScrollArea, Checkbox } from '@mantine/core';
import { Search, Tv } from 'lucide-react';
import type { LibraryItemUI } from '../../types/library.types';

interface AddToListModalProps {
  opened: boolean;
  onClose: () => void;
  listName: string;
  libraryItems: LibraryItemUI[];
  existingContentIds: string[];
  onAdd: (contentIds: string[]) => void;
}

/** Pick library titles to add to a list (excludes ones already in it). */
export function AddToListModal({ opened, onClose, listName, libraryItems, existingContentIds, onAdd }: AddToListModalProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const existing = useMemo(() => new Set(existingContentIds), [existingContentIds]);
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return libraryItems
      .filter((i) => !existing.has(i.contentId))
      .filter((i) => (q ? i.content.title.toLowerCase().includes(q) : true));
  }, [libraryItems, existing, query]);

  const toggle = (contentId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(contentId)) next.delete(contentId);
      else next.add(contentId);
      return next;
    });

  const close = () => {
    setSelected(new Set());
    setQuery('');
    onClose();
  };

  const submit = () => {
    if (selected.size > 0) onAdd(Array.from(selected));
    close();
  };

  return (
    <Modal opened={opened} onClose={close} title={`Add titles to "${listName}"`} centered size="lg">
      <TextInput
        placeholder="Search your library..."
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        leftSection={<Search size={16} />}
        mb="md"
      />
      <ScrollArea h={360} type="auto">
        <div className="space-y-1">
          {candidates.length === 0 && (
            <p className="text-sm text-[rgb(var(--color-text-secondary))] py-8 text-center">
              {query ? 'No matches.' : 'Everything in your library is already on this list.'}
            </p>
          )}
          {candidates.map((item) => {
            const checked = selected.has(item.contentId);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.contentId)}
                className="w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-[rgb(var(--color-bg-elevated))] transition-colors"
              >
                <Checkbox checked={checked} readOnly tabIndex={-1} />
                <div className="flex-shrink-0 w-8 aspect-[2/3] rounded overflow-hidden bg-[rgb(var(--color-bg-elevated))]">
                  {item.content.posterUrl ? (
                    <img src={item.content.posterUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Tv className="w-3.5 h-3.5 text-[rgb(var(--color-text-tertiary))]" />
                    </div>
                  )}
                </div>
                <span className="text-sm text-[rgb(var(--color-text-primary))] truncate">{item.content.title}</span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
      <Group justify="space-between" mt="md">
        <span className="text-sm text-[rgb(var(--color-text-secondary))]">{selected.size} selected</span>
        <Group gap="sm">
          <Button variant="subtle" color="gray" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={selected.size === 0}>
            Add {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </Group>
      </Group>
    </Modal>
  );
}
