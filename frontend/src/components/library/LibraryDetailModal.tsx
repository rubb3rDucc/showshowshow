import { useState, useEffect, useCallback } from 'react';
import { Modal, Drawer, Textarea, Button, Badge, Menu, ActionIcon, Text, Collapse, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { X, Save, Calendar, Trash2, MoreVertical, CheckCircle, ChevronDown, ChevronUp, FileText } from 'lucide-react';
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

const STATUS_OPTIONS: { value: LibraryStatus; label: string; color: string }[] = [
  {
    value: 'watching',
    label: 'WATCHING',
    color: 'bg-blue-500',
  },
  {
    value: 'completed',
    label: 'COMPLETED',
    color: 'bg-green-500',
  },
  {
    value: 'dropped',
    label: 'DROPPED',
    color: 'bg-red-500',
  },
  {
    value: 'plan_to_watch',
    label: 'PLAN TO WATCH',
    color: 'bg-gray-500',
  },
];

interface NotesSectionProps {
  notes: string;
  status: LibraryStatus;
  score: number | null;
  notesSectionOpened: boolean;
  onNotesChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onStatusChange: (status: LibraryStatus) => void;
  onScoreChange: (score: number | null) => void;
  onToggle: () => void;
  onSave: () => void;
}

// Notes Section Component (Magic Patterns style) - Moved outside to prevent re-creation
const NotesSection = ({
  notes,
  status,
  score,
  notesSectionOpened,
  onNotesChange,
  onStatusChange,
  onScoreChange,
  onToggle,
  onSave,
}: NotesSectionProps) => {
  return (
    <div className="border-b border-gray-200 bg-white w-full">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 md:p-8 bg-white hover:bg-white transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-3">
          <FileText size={18} className="text-gray-600" />
          <span className="font-medium text-gray-900">Details & notes</span>
        </div>
        {notesSectionOpened ? (
          <ChevronUp size={18} className="text-gray-400" />
        ) : (
          <ChevronDown size={18} className="text-gray-400" />
        )}
      </button>

      <Collapse 
        in={notesSectionOpened}
        transitionDuration={200}
      >
        <div className="p-6 md:p-8 pt-0 space-y-6 w-full">
          {/* Metadata Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Selector */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onStatusChange(option.value)}
                    className={`
                      min-h-[40px] px-4 py-2 text-sm border border-gray-300 font-medium
                      transition-all
                      ${status === option.value
                        ? `${option.color} text-white border-transparent`
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                      }
                    `}
                    style={{ borderRadius: 0 }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Score Selector */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Score
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onScoreChange(null)}
                  className={`
                    w-10 h-10 text-sm border border-gray-300 font-medium
                    transition-all flex items-center justify-center
                    ${score === null
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                    }
                  `}
                  style={{ borderRadius: 0 }}
                  aria-label="No score"
                >
                  —
                </button>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                  <button
                    key={num}
                    onClick={() => onScoreChange(num)}
                    className={`
                      w-10 h-10 text-sm border border-gray-300 font-medium
                      transition-all flex items-center justify-center
                      ${score === num
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                      }
                    `}
                    style={{ borderRadius: 0 }}
                    aria-label={`Rate ${num} out of 10`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Notes
            </label>
            <Textarea
              placeholder="Add your notes about this show..."
              value={notes}
              onChange={onNotesChange}
              minRows={4}
              maxLength={1000}
              classNames={{
                input: 'border border-gray-300 focus:border-gray-900 bg-white font-medium',
              }}
              styles={{
                input: {
                  borderRadius: 0,
                },
              }}
            />
            <div className="text-right mt-1">
              <span className="text-xs font-medium text-gray-400">
                {notes.length}/1000
              </span>
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={onSave}
            fullWidth
            leftSection={<Save size={16} />}
            className="bg-gray-900 hover:bg-gray-800 text-white font-medium"
            styles={{
              root: {
                borderRadius: 0,
              },
            }}
          >
            Save changes
          </Button>
        </div>
      </Collapse>
    </div>
  );
};

export function LibraryDetailModal({
  item,
  isOpen,
  onClose,
  onSave,
  onAddToQueue,
  onRemove,
}: LibraryDetailModalProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.md})`);
  
  const [status, setStatus] = useState<LibraryStatus>(
    item?.status || 'plan_to_watch',
  );
  const [score, setScore] = useState<number | null>(item?.score || null);
  const [notes, setNotes] = useState(item?.notes || '');
  const [notesSectionOpened, setNotesSectionOpened] = useState(false);

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      setStatus(item.status);
      setScore(item.score);
      setNotes(item.notes || '');
    }
  }, [item]);

  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.currentTarget.value);
  }, []);

  const handleSave = useCallback(() => {
    if (!item) return;
    onSave({
      id: item.id,
      status,
      score: score,
      notes: notes || null,
    });
    onClose();
  }, [item, status, score, notes, onSave, onClose]);

  if (!item) return null;

  const handleRemove = () => {
    if (confirm('Remove this item from your library?')) {
      onRemove(item.id);
      onClose();
    }
  };

  const handleMarkShowWatched = () => {
    setStatus('completed');
    // Note: This would ideally mark all episodes as watched too
    // For now, just update status
  };

  // Header Component (Magic Patterns ShowCardHeader style)
  const ShowCardHeader = () => {
    const progress = item.content.contentType === 'show' && item.progress 
      ? item.progress.percentage 
      : 0;
    const watchedEpisodes = item.progress?.episodesWatched || 0;
    const totalEpisodes = item.progress?.totalEpisodes || 0;

    return (
      <div className="bg-white p-4 sm:p-6 md:p-8 border-b border-gray-200">
        <div className="flex justify-between items-start gap-3 sm:gap-4">
          <div className="flex gap-3 sm:gap-4 items-start flex-1 min-w-0">
            {/* Poster - Responsive sizing */}
            <div className="w-12 h-18 xs:w-14 xs:h-21 sm:w-16 sm:h-24 md:w-20 md:h-28 lg:w-24 lg:h-36 bg-gray-900 flex-shrink-0 overflow-hidden">
              {item.content.posterUrl ? (
                <img
                  src={item.content.posterUrl}
                  alt={item.content.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-[10px] sm:text-xs font-medium px-1 text-center">
                  POSTER
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 leading-tight break-words">
                {item.content.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  size="sm"
                  color="dark"
                  variant="filled"
                  className="font-medium text-xs"
                  styles={{
                    root: {
                      borderRadius: 0,
                      backgroundColor: '#000000',
                      color: '#ffffff',
                    },
                  }}
                >
                  {item.content.contentType === 'movie' ? 'MOVIE' : 'TV'}
                </Badge>
                {item.content.contentType === 'show' && item.progress && (
                  <Text
                    size="xs"
                    fw={500}
                    c="dimmed"
                    className="text-[10px] sm:text-xs"
                  >
                    {watchedEpisodes}/{totalEpisodes} ep • {progress}%
                  </Text>
                )}
              </div>

              {/* Progress Bar */}
              {item.content.contentType === 'show' && item.progress && (
                <div className="w-full max-w-[150px] sm:max-w-[200px] bg-gray-200 h-1.5 sm:h-2 overflow-hidden mt-1">
                  <div
                    className="bg-gray-900 h-full transition-all duration-500 ease-out"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <Badge
              size="sm"
              color="dark"
              variant="filled"
              className="font-medium text-xs"
              styles={{
                root: {
                  borderRadius: 0,
                  backgroundColor: '#000000',
                  color: '#ffffff',
                },
              }}
            >
              {STATUS_OPTIONS.find(o => o.value === status)?.label || status.toUpperCase()}
            </Badge>

            <Menu position="bottom-end" shadow="sm" width={200}>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="md"
                  className="text-gray-600 hover:bg-gray-100"
                  aria-label="Show actions"
                  styles={{
                    root: {
                      borderRadius: 0,
                    },
                  }}
                >
                  <MoreVertical size={16} className="sm:w-[18px] sm:h-[18px]" />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown
                className="border border-gray-200"
                style={{
                  borderRadius: 0,
                }}
              >
                <Menu.Label className="text-xs font-medium">
                  Show actions
                </Menu.Label>
                {item.content.contentType === 'show' && (
                  <Menu.Item
                    leftSection={<CheckCircle size={14} />}
                    onClick={handleMarkShowWatched}
                    className="font-medium text-gray-700 text-sm"
                  >
                    Mark all watched
                  </Menu.Item>
                )}
                <Menu.Item
                  leftSection={<Calendar size={14} />}
                  onClick={() => onAddToQueue(item)}
                  className="font-medium text-gray-700 text-sm"
                >
                  Add to Queue
                </Menu.Item>
                <Menu.Divider />
                <Menu.Label className="text-xs font-medium">
                  Danger zone
                </Menu.Label>
                <Menu.Item
                  color="red"
                  leftSection={<Trash2 size={14} />}
                  onClick={handleRemove}
                  className="font-medium text-sm"
                >
                  Remove from library
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<X size={14} />}
                  onClick={onClose}
                  className="font-medium text-gray-700 text-sm"
                >
                  Close
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        </div>
      </div>
    );
  };



  // Render content directly (not as a component to avoid render-time creation)
  const renderContent = () => (
    <div className="bg-white flex flex-col w-full">
      {/* Close Button - Prominent and visible */}
      <div className="flex justify-end p-4 border-brelative">
        <button
          onClick={onClose}
          className='flex items-center justify-center relative bg-white border-gray-700 border-2 hover:border-blue-600'
          aria-label="Close modal"
        >
        <X size={20} color="red" />
        </button>
      </div>

      {/* Show Card Header */}
      <ShowCardHeader />

      {/* Notes Section */}
      <NotesSection
        notes={notes}
        status={status}
        score={score}
        notesSectionOpened={notesSectionOpened}
        onNotesChange={handleNotesChange}
        onStatusChange={setStatus}
        onScoreChange={setScore}
        onToggle={() => setNotesSectionOpened(!notesSectionOpened)}
        onSave={handleSave}
      />

      {/* Episode Tracker for TV Shows */}
      {item.content.contentType === 'show' && (
        <div className="w-full">
          <EpisodeTracker
            libraryItem={item}
            onEpisodeUpdate={(season, episode, watched) => {
              console.log('Episode update:', season, episode, watched);
            }}
          />
        </div>
      )}
    </div>
  );

  // Mobile: Use Drawer (bottom sheet)
  if (isMobile) {
    return (
      <Drawer
        opened={isOpen}
        onClose={onClose}
        position="bottom"
        size="auto"
        padding={0}
        withCloseButton={false}
        closeOnClickOutside={true}
        closeOnEscape={true}
        trapFocus={true}
        classNames={{
          content: 'border-t border-gray-200 bg-white',
          body: 'p-0 flex flex-col w-full',
        }}
        styles={{
          content: {
            borderTopLeftRadius: '1rem',
            borderTopRightRadius: '1rem',
            width: '100%',
            maxWidth: '100%',
            maxHeight: '90vh',
            height: 'auto',
            margin: 'auto',
          },
          body: {
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
          },
        }}
      >
        {renderContent()}
      </Drawer>
    );
  }

  // Desktop: Use Modal (centered)
  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      size="auto"
      padding={0}
      centered
      withCloseButton={false}
      classNames={{
        content: 'border border-gray-200 bg-white shadow-xl',
        body: 'p-0 w-full',
      }}
      styles={{
        content: {
          width: '100%',
          maxWidth: '800px',
          maxHeight: '90vh',
          height: 'auto',
        },
        body: {
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        },
      }}
    >
      {renderContent()}
    </Modal>
  );
}
