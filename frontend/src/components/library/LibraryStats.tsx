import { useState } from 'react';
import { Collapse } from '@mantine/core';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { LibraryStats as LibraryStatsType } from '../../types/library.types';

interface LibraryStatsProps {
  stats: LibraryStatsType;
  alwaysExpanded?: boolean;
}

const STAT_CARDS = [
  {
    key: 'totalItems',
    label: 'TOTAL ITEMS',
    code: 'TOT',
    color: 'bg-blue-200',
  },
  {
    key: 'watching',
    label: 'WATCHING',
    code: 'WCH',
    color: 'bg-cyan-200',
  },
  {
    key: 'completed',
    label: 'COMPLETED',
    code: 'CMP',
    color: 'bg-green-200',
  },
  {
    key: 'planToWatch',
    label: 'PLAN TO WATCH',
    code: 'PLN',
    color: 'bg-yellow-200',
  },
  {
    key: 'totalShows',
    label: 'TV SHOWS',
    code: 'TVS',
    color: 'bg-purple-200',
  },
  {
    key: 'totalMovies',
    label: 'MOVIES',
    code: 'MOV',
    color: 'bg-pink-200',
  },
  {
    key: 'totalEpisodesWatched',
    label: 'EPISODES WATCHED',
    code: 'EPS',
    color: 'bg-orange-200',
  },
  {
    key: 'dropped',
    label: 'DROPPED',
    code: 'DRP',
    color: 'bg-rose-200',
  },
];

export function LibraryStats({ stats, alwaysExpanded = false }: LibraryStatsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // If alwaysExpanded is true, don't render the collapsible header
  if (alwaysExpanded) {
    return (
      <div className="mb-6 md:mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {STAT_CARDS.map((card) => (
            <div
              key={card.key}
              className="bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm overflow-hidden"
            >
              {/* Colored Top Strip */}
              <div className={`h-4 ${card.color}`} />

              <div className="p-4 md:p-6">
                {/* Code Badge */}
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-gray-900 text-white px-2 py-1 text-[10px] font-semibold tracking-tight">
                    {card.code}
                  </div>
                </div>

                {/* Number - Large */}
                <div className="text-5xl md:text-6xl font-semibold leading-none mb-2 tracking-tighter text-[rgb(var(--color-text-primary))]">
                  {stats[card.key as keyof LibraryStatsType]}
                </div>

                {/* Label */}
                <div className="text-xs md:leading-tight text-[rgb(var(--color-text-primary))] mb-3">
                  {card.label}
                </div>

                {/* Bottom Barcode Pattern */}
                <div className="flex h-2 gap-[2px]">
                  <div className="w-1 bg-gray-900" />
                  <div className="w-[3px] bg-gray-900" />
                  <div className="w-1 bg-gray-900" />
                  <div className="w-2 bg-gray-900" />
                  <div className="w-1 bg-gray-900" />
                  <div className="w-[3px] bg-gray-900" />
                  <div className="w-1 bg-gray-900" />
                  <div className="w-2 bg-gray-900" />
                  <div className="flex-1" />
                  <div className="w-1 bg-gray-900" />
                  <div className="w-2 bg-gray-900" />
                  <div className="w-1 bg-gray-900" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Collapsible version for other uses
  return (
    <div className="mb-6 md:mb-8">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm p-4 flex items-center justify-between hover:bg-[rgb(var(--color-bg-page))] transition-colors mb-3"
      >
        <div className="flex items-center gap-3">
          <div className="bg-gray-900 text-white px-2 py-1 text-[10px] font-semibold tracking-tight">
            STATS
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Library Statistics
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp size={20} strokeWidth={3} />
        ) : (
          <ChevronDown size={20} strokeWidth={3} />
        )}
      </button>

      {/* Collapsible Stats Grid */}
      <Collapse in={isExpanded}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {STAT_CARDS.map((card) => (
            <div
              key={card.key}
              className="bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm overflow-hidden"
            >
              {/* Colored Top Strip */}
              <div className={`h-4 ${card.color}`} />

              <div className="p-4 md:p-6">
                {/* Code Badge */}
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-gray-900 text-white px-2 py-1 text-[10px] font-semibold tracking-tight">
                    {card.code}
                  </div>
                </div>

                {/* Number - Large */}
                <div className="text-5xl md:text-6xl font-semibold leading-none mb-2 tracking-tighter text-[rgb(var(--color-text-primary))]">
                  {stats[card.key as keyof LibraryStatsType]}
                </div>

                {/* Label */}
                <div className="text-xs md:leading-tight text-[rgb(var(--color-text-primary))] mb-3">
                  {card.label}
                </div>

                {/* Bottom Barcode Pattern */}
                <div className="flex h-2 gap-[2px]">
                  <div className="w-1 bg-gray-900" />
                  <div className="w-[3px] bg-gray-900" />
                  <div className="w-1 bg-gray-900" />
                  <div className="w-2 bg-gray-900" />
                  <div className="w-1 bg-gray-900" />
                  <div className="w-[3px] bg-gray-900" />
                  <div className="w-1 bg-gray-900" />
                  <div className="w-2 bg-gray-900" />
                  <div className="flex-1" />
                  <div className="w-1 bg-gray-900" />
                  <div className="w-2 bg-gray-900" />
                  <div className="w-1 bg-gray-900" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Collapse>
    </div>
  );
}
