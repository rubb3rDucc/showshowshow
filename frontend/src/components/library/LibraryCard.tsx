import { useState, useEffect } from 'react';
import { Badge, Button, Collapse, Select, Textarea } from '@mantine/core';
import { ChevronDown, ChevronUp, Save, Palette, Trash2 } from 'lucide-react';
import type { LibraryItemUI, LibraryCardColor, LibraryStatus } from '../../types/library.types';
import { EpisodeTracker } from './EpisodeTracker';

interface LibraryCardProps {
  item: LibraryItemUI;
  onViewDetails: (item: LibraryItemUI) => void;
  onChangeStatus: (item: LibraryItemUI) => void;
  onAddToQueue: (item: LibraryItemUI) => void;
  onRemove: (id: string) => void;
  onSave: (updates: Partial<LibraryItemUI>) => void;
}

const COLOR_SCHEMES: Record<
  LibraryCardColor,
  {
    bg: string;
    text: string;
    border: string;
  }
> = {
  yellow: {
    bg: 'bg-yellow-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  pink: {
    bg: 'bg-pink-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  cyan: {
    bg: 'bg-cyan-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  purple: {
    bg: 'bg-purple-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  blue: {
    bg: 'bg-blue-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  orange: {
    bg: 'bg-orange-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  green: {
    bg: 'bg-green-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  rose: {
    bg: 'bg-rose-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  indigo: {
    bg: 'bg-indigo-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  teal: {
    bg: 'bg-teal-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
};

const COLOR_OPTIONS: {
  value: LibraryCardColor;
  label: string;
}[] = [
  {
    value: 'yellow',
    label: 'YELLOW',
  },
  {
    value: 'pink',
    label: 'PINK',
  },
  {
    value: 'cyan',
    label: 'CYAN',
  },
  {
    value: 'purple',
    label: 'PURPLE',
  },
  {
    value: 'blue',
    label: 'BLUE',
  },
  {
    value: 'orange',
    label: 'ORANGE',
  },
  {
    value: 'green',
    label: 'GREEN',
  },
  {
    value: 'rose',
    label: 'ROSE',
  },
  {
    value: 'indigo',
    label: 'INDIGO',
  },
  {
    value: 'teal',
    label: 'TEAL',
  },
];

const STATUS_STYLES = {
  watching: {
    bg: 'bg-blue-500',
    text: 'text-white',
    label: 'WATCHING',
  },
  completed: {
    bg: 'bg-green-500',
    text: 'text-white',
    label: 'COMPLETED',
  },
  dropped: {
    bg: 'bg-red-500',
    text: 'text-white',
    label: 'DROPPED',
  },
  plan_to_watch: {
    bg: 'bg-gray-500',
    text: 'text-white',
    label: 'PLAN TO WATCH',
  },
};

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
      label: ` ${i + 1}/10`,
    }),
  ),
];

export function LibraryCard({
  item,
  onSave,
  onRemove,
}: LibraryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [isEpisodeTrackerExpanded, setIsEpisodeTrackerExpanded] =
    useState(false);
  const [status, setStatus] = useState(item.status);
  const [score, setScore] = useState(item.score?.toString() || '');
  const [notes, setNotes] = useState(item.notes || '');
  // Persist cardColor in localStorage keyed by item ID
  const getStoredCardColor = (): LibraryCardColor => {
    if (item.cardColor) return item.cardColor;
    const stored = localStorage.getItem(`library-card-color-${item.id}`);
    return (stored as LibraryCardColor) || 'blue';
  };

  const [cardColor, setCardColor] = useState<LibraryCardColor>(getStoredCardColor());

  const colors = COLOR_SCHEMES[cardColor];
  const statusStyle = STATUS_STYLES[item.status];

  const handleSave = () => {
    // Save cardColor to localStorage
    localStorage.setItem(`library-card-color-${item.id}`, cardColor);
    
    onSave({
      id: item.id,
      status,
      score: score ? parseInt(score) : null,
      notes: notes || null,
      cardColor,
    });
  };

  const handleRemove = () => {
    if (confirm('Remove this item from your library?')) {
      // Remove cardColor from localStorage
      localStorage.removeItem(`library-card-color-${item.id}`);
      onRemove(item.id);
    }
  };

  // Update localStorage when cardColor changes (even without save)
  useEffect(() => {
    localStorage.setItem(`library-card-color-${item.id}`, cardColor);
  }, [cardColor, item.id]);

  return (
    <div className={`${expanded ? 'md:col-span-2 lg:col-span-3' : ''}`}>
      <div
        className={`${colors.bg} ${colors.text} border-2 ${colors.border} font-mono`}
      >
        {/* Compact Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-start gap-3 p-3 hover:opacity-90 transition-opacity text-left ${colors.bg}`}
        >
          {/* Small Poster */}
          <div
            className={`relative w-[50px] h-[75px] flex-shrink-0 border ${colors.border} overflow-hidden bg-gray-100`}
          >
            {item.content.posterUrl ? (
              <img
                src={item.content.posterUrl}
                alt={item.content.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[8px] font-black">
                NO IMG
              </div>
            )}
          </div>

          {/* Content Info */}
          <div className="flex-1 min-w-0">
            {/* Title & Status */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-sm md:text-base font-black uppercase leading-tight tracking-tight flex-1">
                {item.content.title}
              </h3>
              <Badge
                className={`${statusStyle.bg} ${statusStyle.text} border border-gray-900 font-black uppercase tracking-widest text-[8px] flex-shrink-0`}
                size="xs"
                radius="xs"
              >
                {statusStyle.label}
              </Badge>
            </div>

            {/* Metadata Row */}
            <div className="flex gap-2 items-center flex-wrap mb-2">
              <Badge
                className="bg-black text-white border border-black font-black uppercase tracking-widest text-[8px]"
                size="xs"
                radius="xs"
              >
                {item.content.contentType === 'movie' ? 'FILM' : 'TV'}
              </Badge>

              {item.content.contentType === 'show' && item.progress && (
                <>
                  <span className="text-[10px] font-black opacity-70">
                    {item.progress.episodesWatched}/
                    {item.progress.totalEpisodes} EP
                  </span>
                  <span className="text-[10px] font-black opacity-70">
                    {item.progress.percentage}%
                  </span>
                </>
              )}

              {item.score && (
                <span className="text-[10px] font-black opacity-70">
                  ⭐ {item.score}/10
                </span>
              )}
            </div>

            {/* Progress Bar */}
            {item.content.contentType === 'show' && item.progress && (
              <div
                className={`h-1.5 bg-gray-900 bg-opacity-20 border ${colors.border}`}
              >
                <div
                  className="h-full bg-gray-900"
                  style={{
                    width: `${item.progress.percentage}%`,
                  }}
                />
              </div>
            )}
          </div>

          {/* Expand Icon */}
          <div className="flex-shrink-0 pt-1">
            {expanded ? (
              <ChevronUp size={16} strokeWidth={3} />
            ) : (
              <ChevronDown size={16} strokeWidth={3} />
            )}
          </div>
        </button>

        {/* Expanded Details Section */}
        <Collapse in={expanded}>
          <div
            className={`border-t-2 ${colors.border} p-4 md:p-6 space-y-4 bg-white bg-opacity-50`}
          >
            {/* Status, Score & Color Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider mb-1">
                  STATUS
                </label>
                <Select
                  data={STATUS_OPTIONS}
                  value={status}
                  onChange={(value) => setStatus(value as LibraryStatus)}
                  size="xs"
                  classNames={{
                    input:
                      'border-2 border-gray-900 font-mono font-black uppercase text-[10px]',
                  }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider mb-1">
                  SCORE
                </label>
                <Select
                  data={SCORE_OPTIONS}
                  value={score}
                  onChange={(value) => setScore(value || '')}
                  size="xs"
                  classNames={{
                    input:
                      'border-2 border-gray-900 font-mono font-black uppercase text-[10px]',
                  }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider mb-1">
                  CARD COLOR
                </label>
                <Select
                  data={COLOR_OPTIONS}
                  value={cardColor}
                  onChange={(value) => setCardColor(value as LibraryCardColor)}
                  size="xs"
                  leftSection={<Palette size={12} />}
                  classNames={{
                    input:
                      'border-2 border-gray-900 font-mono font-black uppercase text-[10px]',
                  }}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  fullWidth
                  size="xs"
                  className="bg-black text-white border-2 border-black font-black uppercase tracking-wider"
                  radius="xs"
                  leftSection={<Save size={12} />}
                  onClick={handleSave}
                >
                  SAVE
                </Button>
                <Button
                  size="xs"
                  className="bg-red-500 text-white border-2 border-red-500 font-black uppercase tracking-wider"
                  radius="xs"
                  leftSection={<Trash2 size={12} />}
                  onClick={handleRemove}
                >
                  REMOVE
                </Button>
              </div>
            </div>

            {/* Collapsible Description */}
            {item.content.description && (
              <div className="bg-white border-2 border-gray-900">
                <button
                  onClick={() =>
                    setIsDescriptionExpanded(!isDescriptionExpanded)
                  }
                  className="w-full flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="bg-gray-900 text-white px-2 py-1 text-[10px] font-black tracking-widest">
                      DESC
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider">
                      Description
                    </span>
                  </div>
                  {isDescriptionExpanded ? (
                    <ChevronUp size={16} strokeWidth={3} />
                  ) : (
                    <ChevronDown size={16} strokeWidth={3} />
                  )}
                </button>
                <Collapse in={isDescriptionExpanded}>
                  <div className="p-3">
                    <p className="text-xs md:text-sm leading-relaxed opacity-80">
                      {item.content.description}
                    </p>
                  </div>
                </Collapse>
              </div>
            )}

            {/* Collapsible General Notes */}
            <div className="bg-white border-2 border-gray-900">
              <button
                onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                className="w-full flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="bg-gray-900 text-white px-2 py-1 text-[10px] font-black tracking-widest">
                    NOTE
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider">
                    General Notes
                  </span>
                </div>
                {isNotesExpanded ? (
                  <ChevronUp size={16} strokeWidth={3} />
                ) : (
                  <ChevronDown size={16} strokeWidth={3} />
                )}
              </button>
              <Collapse in={isNotesExpanded}>
                <div className="p-3">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ADD YOUR NOTES ABOUT THIS SHOW/MOVIE..."
                    rows={3}
                    size="xs"
                    maxLength={1000}
                    classNames={{
                      input: 'border-2 border-gray-900 font-mono text-xs',
                    }}
                  />
                  <div className="text-[10px] text-gray-500 mt-1 text-right">
                    {notes.length}/1000
                  </div>
                </div>
              </Collapse>
            </div>

            {/* Collapsible Episode Tracker for TV Shows */}
            {item.content.contentType === 'show' && (
              <div className="bg-white border-2 border-gray-900">
                <div
                  onClick={() =>
                    setIsEpisodeTrackerExpanded(!isEpisodeTrackerExpanded)
                  }
                  className="w-full flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsEpisodeTrackerExpanded(!isEpisodeTrackerExpanded);
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="bg-gray-900 text-white px-2 py-1 text-[10px] font-black tracking-widest">
                      TRACK
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider">
                      Episode Tracker
                    </span>
                  </div>
                  {isEpisodeTrackerExpanded ? (
                    <ChevronUp size={16} strokeWidth={3} />
                  ) : (
                    <ChevronDown size={16} strokeWidth={3} />
                  )}
                </div>
                <Collapse in={isEpisodeTrackerExpanded}>
                  <div className="p-3">
                    <EpisodeTracker
                      libraryItem={item}
                      onEpisodeUpdate={(season, episode, watched) => {
                        console.log('Episode update:', season, episode, watched);
                      }}
                    />
                  </div>
                </Collapse>
              </div>
            )}
          </div>
        </Collapse>

        {/* Bottom Border Accent */}
        <div className={`h-1 ${colors.border} bg-current opacity-20`} />
      </div>
    </div>
  );
}
