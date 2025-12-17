import { Badge } from '@mantine/core'
import type { ScheduleCardItem, QueueCardItem } from './scheduleCardAdapters'

interface ScheduleCardProps {
  scheduleItem: ScheduleCardItem
  queueItem?: QueueCardItem
  onMarkWatched?: (id: string) => void
  rowNumber: number
  season?: number | null
  episode?: number | null
  episodeTitle?: string | null
}

// Pastel color schemes for softer aesthetic
const COLOR_SCHEMES = [
  {
    bg: 'bg-yellow-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  {
    bg: 'bg-pink-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  {
    bg: 'bg-cyan-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  {
    bg: 'bg-purple-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  {
    bg: 'bg-blue-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  {
    bg: 'bg-orange-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  {
    bg: 'bg-green-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  {
    bg: 'bg-rose-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  {
    bg: 'bg-indigo-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
  {
    bg: 'bg-teal-200',
    text: 'text-gray-900',
    border: 'border-gray-900',
  },
]

export function ScheduleCard({
  scheduleItem,
  queueItem,
  rowNumber,
  season,
  episode,
  episodeTitle,
}: ScheduleCardProps) {
  const colorIndex =
    parseInt(scheduleItem.id.replace(/\D/g, '') || '0') % COLOR_SCHEMES.length
  const colors = COLOR_SCHEMES[colorIndex]
  const durationMinutes = Math.round(
    (scheduleItem.endTime.getTime() - scheduleItem.startTime.getTime()) / 60000,
  )
  const startTime = scheduleItem.startTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const endTime = scheduleItem.endTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return (
    <div
      className={`
        relative
        ${colors.bg} ${colors.text}
        border-2 ${colors.border}
        font-mono
      `}
    >
      {/* Mobile Layout (< md) */}
      <div className="md:hidden">
        <div className="flex items-stretch min-h-[100px]">
          {/* Row Number */}
          <div
            className={`w-12 border-r-2 ${colors.border} flex items-center justify-center flex-shrink-0`}
          >
            <div className="text-2xl font-black leading-none">
              {rowNumber.toString().padStart(2, '0')}
            </div>
          </div>

          {/* Poster */}
          <div
            className={`w-16 border-r-2 ${colors.border} flex items-center justify-center p-1 flex-shrink-0`}
          >
            {queueItem?.posterUrl ? (
              <div
                className={`w-full h-20 border ${colors.border} overflow-hidden`}
              >
                <img
                  src={queueItem.posterUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className={`w-full h-20 border ${colors.border} flex items-center justify-center text-[8px] font-black`}
              >
                NO IMG
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
            <div>
              <h2 className="text-lg font-black uppercase leading-tight tracking-tight break-words mb-1">
                {queueItem?.title || scheduleItem.title}
              </h2>
              {queueItem?.type === 'show' && season !== null && episode !== null && (
                <div className="mb-2">
                  <div className="text-xs font-black uppercase tracking-tight opacity-80">
                    S{String(season).padStart(2, '0')}E{String(episode).padStart(2, '0')}
                    {episodeTitle && ` • ${episodeTitle}`}
                  </div>
                </div>
              )}
              <Badge
                className="bg-black text-white border-black font-black uppercase tracking-wider text-[10px]"
                size="sm"
                color='black'
                // radius="xs"
              >
                {queueItem?.type === 'movie' ? 'FILM' : 'SERIES'}
              </Badge>
            </div>
            <div className="flex justify-between items-end mt-2">
              <div className="text-sm font-black leading-none">
                {startTime} — {endTime}
              </div>
              <div className="text-sm font-black leading-none opacity-80">
                {durationMinutes}m
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout (>= md) */}
      <div className="hidden md:grid grid-cols-12 min-h-[120px]">
        {/* Column 1: Row Number */}
        <div
          className={`col-span-1 border-r-2 ${colors.border} flex items-center justify-center p-3`}
        >
          <div className="text-3xl lg:text-4xl font-black leading-none">
            {rowNumber.toString().padStart(2, '0')}
          </div>
        </div>

        {/* Column 2: Poster */}
        <div
          className={`col-span-2 border-r-2 ${colors.border} flex items-center justify-center p-2`}
        >
          {queueItem?.posterUrl ? (
            <div
              className={`w-full h-20 lg:h-24 border ${colors.border} overflow-hidden`}
            >
              <img
                src={queueItem.posterUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div
              className={`w-full h-20 lg:h-24 border ${colors.border} flex items-center justify-center text-xs font-black`}
            >
              NO IMAGE
            </div>
          )}
        </div>

        {/* Column 3: Time */}
        <div
          className={`col-span-3 border-r-2 ${colors.border} flex flex-col items-center justify-center p-3 gap-1`}
        >
          <div className="text-2xl lg:text-3xl font-black leading-none tracking-tighter">
            {startTime}
          </div>
          <div className="text-lg lg:text-xl font-black leading-none opacity-60">
            —
          </div>
          <div className="text-2xl lg:text-3xl font-black leading-none tracking-tighter">
            {endTime}
          </div>
        </div>

        {/* Column 4: Title & Type */}
        <div
          className={`col-span-5 border-r-2 ${colors.border} flex flex-col justify-center p-4 lg:p-5 gap-2`}
        >
          <h2 className="text-xl lg:text-2xl xl:text-3xl font-black uppercase leading-[0.95] tracking-tight break-words">
            {queueItem?.title || scheduleItem.title}
          </h2>
          {queueItem?.type === 'show' && season !== null && episode !== null && (
            <div className="text-sm lg:text-base font-black uppercase tracking-tight opacity-80">
              S{String(season).padStart(2, '0')}E{String(episode).padStart(2, '0')}
              {episodeTitle && ` • ${episodeTitle}`}
            </div>
          )}
          <div className="flex gap-2 items-center">
              <Badge
                className="bg-black text-white border-black font-black uppercase tracking-wider text-[10px]"
                size="sm"
                color='black'
                // radius="xs"
              >
              {queueItem?.type === 'movie' ? 'FILM' : 'SERIES'}
            </Badge>
          </div>
        </div>

        {/* Column 5: Duration */}
        <div className="col-span-1 flex flex-col items-center justify-center p-3 gap-1">
          <div className="text-2xl lg:text-3xl font-black leading-none">
            {durationMinutes}
          </div>
          <div className="text-[10px] lg:text-xs font-black uppercase tracking-wider opacity-80">
            MIN
          </div>
        </div>
      </div>

      {/* Bottom Border Accent */}
      <div className={`h-1 ${colors.border} bg-current opacity-20`} />
    </div>
  )
}

