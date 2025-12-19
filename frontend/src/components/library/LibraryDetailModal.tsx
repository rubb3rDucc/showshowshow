import { useState, useEffect } from 'react';
import { Modal, Select, Textarea, Button, Badge } from '@mantine/core';
import { X, Save, Calendar, Trash2 } from 'lucide-react';
import type { LibraryItemUI, LibraryStatus } from '../../types/library.types';
import { EpisodeTracker } from './EpisodeTracker';

interface LibraryDetailModalProps {
  item: LibraryItemUI | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<LibraryItemUI>) => void;
  onAddToQueue: (item: LibraryItemUI) => void;
  onRemove: (id: string) => void;
}

const STATUS_OPTIONS = [
  {
    value: 'watching',
    label: 'WATCHING',
  },
  {
    value: 'completed',
    label: 'COMPLETED',
  },
  {
    value: 'dropped',
    label: 'DROPPED',
  },
  {
    value: 'plan_to_watch',
    label: 'PLAN TO WATCH',
  },
];

const SCORE_OPTIONS = [
  {
    value: '',
    label: 'NO SCORE',
  },
  ...Array.from(
    {
      length: 10,
    },
    (_, i) => ({
      value: String(i + 1),
      label: `⭐ ${i + 1}/10`,
    }),
  ),
];

export function LibraryDetailModal({
  item,
  isOpen,
  onClose,
  onSave,
  onAddToQueue,
  onRemove,
}: LibraryDetailModalProps) {
  const [status, setStatus] = useState<LibraryStatus>(
    item?.status || 'plan_to_watch',
  );
  const [score, setScore] = useState<string>(item?.score?.toString() || '');
  const [notes, setNotes] = useState(item?.notes || '');

  // Update state when item changes
  useEffect(() => {
    if (item) {
      setStatus(item.status);
      setScore(item.score?.toString() || '');
      setNotes(item.notes || '');
    }
  }, [item]);

  if (!item) return null;

  const handleSave = () => {
    onSave({
      id: item.id,
      status,
      score: score ? parseInt(score) : null,
      notes: notes || null,
    });
    onClose();
  };

  const handleRemove = () => {
    if (confirm('Remove this item from your library?')) {
      onRemove(item.id);
      onClose();
    }
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      size="xl"
      padding={0}
      withCloseButton={false}
      classNames={{
        content: 'border-4 border-gray-900 font-mono bg-gray-50',
        body: 'p-0',
      }}
    >
      <div className="bg-gray-50">
        {/* Header */}
        <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-gray-900">
          <h2 className="text-lg font-black uppercase tracking-tight">
            {item.content.title}
          </h2>
          <button
            onClick={onClose}
            className="hover:opacity-70 transition-opacity"
          >
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Poster & Basic Info */}
          <div className="flex gap-4">
            <div className="w-32 flex-shrink-0">
              <div className="aspect-[2/3] border-2 border-gray-900 overflow-hidden bg-gray-100">
                {item.content.posterUrl ? (
                  <img
                    src={item.content.posterUrl}
                    alt={item.content.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-black">
                    NO IMAGE
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <Badge
                  className="bg-black text-white border-2 border-black font-black uppercase tracking-widest text-[10px] mb-2"
                  size="sm"
                  radius="xs"
                >
                  {item.content.contentType === 'movie' ? 'FILM' : 'TV SHOW'}
                </Badge>
                {item.content.description && (
                  <p className="text-sm leading-relaxed opacity-80">
                    {item.content.description}
                  </p>
                )}
              </div>

              {item.content.contentType === 'show' && item.progress && (
                <div className="bg-blue-200 border-2 border-gray-900 p-3">
                  <div className="text-xs font-black uppercase tracking-wider opacity-70 mb-1">
                    PROGRESS
                  </div>
                  <div className="text-2xl font-black">
                    {item.progress.episodesWatched}/
                    {item.progress.totalEpisodes}
                  </div>
                  <div className="text-xs font-black uppercase tracking-wider opacity-70">
                    {item.progress.percentage}% COMPLETE
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Selector */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-2">
              STATUS
            </label>
            <Select
              data={STATUS_OPTIONS}
              value={status}
              onChange={(value) => setStatus(value as LibraryStatus)}
              classNames={{
                input:
                  'border-2 border-gray-900 font-mono font-black uppercase',
              }}
            />
          </div>

          {/* Score Selector */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-2">
              SCORE
            </label>
            <Select
              data={SCORE_OPTIONS}
              value={score}
              onChange={(value) => setScore(value || '')}
              classNames={{
                input:
                  'border-2 border-gray-900 font-mono font-black uppercase',
              }}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-2">
              NOTES
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ADD YOUR NOTES..."
              rows={4}
              maxLength={1000}
              classNames={{
                input: 'border-2 border-gray-900 font-mono',
              }}
            />
            <div className="text-xs text-gray-500 mt-1 text-right">
              {notes.length}/1000
            </div>
          </div>

          {/* Episode Tracker for TV Shows */}
          {item.content.contentType === 'show' && (
            <EpisodeTracker
              libraryItem={item}
              onEpisodeUpdate={(season, episode, watched) => {
                console.log('Episode update:', season, episode, watched);
              }}
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t-4 border-gray-900 p-4 bg-white flex gap-3">
          <Button
            fullWidth
            size="md"
            className="bg-black text-white border-2 border-black font-black uppercase tracking-wider"
            radius="xs"
            leftSection={<Save size={16} />}
            onClick={handleSave}
          >
            SAVE CHANGES
          </Button>
          <Button
            fullWidth
            size="md"
            className="bg-blue-500 text-white border-2 border-blue-500 font-black uppercase tracking-wider"
            radius="xs"
            leftSection={<Calendar size={16} />}
            onClick={() => onAddToQueue(item)}
          >
            ADD TO QUEUE
          </Button>
          <Button
            size="md"
            className="bg-red-500 text-white border-2 border-red-500 font-black uppercase tracking-wider"
            radius="xs"
            onClick={handleRemove}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
    </Modal>
  );
}

