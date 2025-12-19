import { useState } from 'react'
import { Badge, Button } from '@mantine/core'
import { Plus, Check, ChevronUp, ChevronDown, BookOpen } from 'lucide-react'
import type { SearchResult } from '../../types/api'
import type { LibraryStatus } from '../../types/library.types'
import { normalizeRating } from '../../utils/rating'

interface SearchResultCardProps {
  item: SearchResult
  isInQueue?: boolean
  onAddToQueue: (item: SearchResult) => void
  isLoading?: boolean
  titlePreference?: 'english' | 'japanese' | 'romanji'
  // Library props
  isInLibrary?: boolean
  libraryStatus?: LibraryStatus | null
  onAddToLibrary?: (item: SearchResult) => void
  isAddingToLibrary?: boolean
}

// Pastel color schemes matching schedule page
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

const STATUS_BADGE_COLORS: Record<LibraryStatus, string> = {
  watching: 'bg-blue-500',
  completed: 'bg-green-500',
  dropped: 'bg-red-500',
  plan_to_watch: 'bg-gray-500',
}

const STATUS_LABELS: Record<LibraryStatus, string> = {
  watching: 'WATCHING',
  completed: 'COMPLETED',
  dropped: 'DROPPED',
  plan_to_watch: 'PLAN TO WATCH',
}

export function SearchResultCard({
  item,
  isInQueue,
  onAddToQueue,
  isLoading = false,
  titlePreference = 'english',
  isInLibrary = false,
  libraryStatus = null,
  onAddToLibrary,
  isAddingToLibrary = false,
}: SearchResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const colorIndex =
    parseInt(String(item.tmdb_id).replace(/\D/g, '') || '0') % COLOR_SCHEMES.length
  const colors = COLOR_SCHEMES[colorIndex]
  
  // Determine which title to display based on preference
  // Fallback order: preferred -> english -> japanese -> romanji -> title
  const displayTitle = (() => {
    switch (titlePreference) {
      case 'japanese':
        return item.title_japanese || item.title_english || item.title
      case 'romanji':
        return item.title || item.title_english || item.title_japanese
      case 'english':
      default:
        return item.title_english || item.title || item.title_japanese
    }
  })()
  
  return (
    <div
      className={`
        ${colors.bg} ${colors.text}
        border-2 ${colors.border}
        font-mono
        flex flex-col
        h-full
      `}
    >
      {/* Poster Image */}
      <div
        className={`relative w-full aspect-[2/3] border-b-2 ${colors.border} overflow-hidden bg-gray-100`}
      >
        {item.poster_url ? (
          <img
            src={item.poster_url}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-black">
            NO IMAGE
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Title */}
        <h3 className="text-base md:text-lg font-black uppercase leading-tight tracking-tight line-clamp-2">
          {displayTitle}
        </h3>

        {/* Type Badge, Year, and Rating - White on Black */}
        <div className="flex gap-2 items-center flex-wrap">
          <Badge
           className=" text-white border-black font-black uppercase tracking-wider text-[10px]"
                size="xs"
                color='black'
          >
            {item.content_type === 'movie' ? 'FILM' : 'SERIES'}
          </Badge>
          {/* Year Badge */}
          {item.release_date && (
            <Badge
              className="text-white border-black font-black uppercase tracking-wider text-[10px]"
              size="xs"
              color="black"
            >
              {new Date(item.release_date).getFullYear()}
            </Badge>
          )}
          {/* Rating Badge */}
          {normalizeRating(item.rating) && (
            <Badge
              className="text-white border-black font-black uppercase tracking-wider text-[10px]"
              size="xs"
              color="black"
            >
              {normalizeRating(item.rating)}
            </Badge>
          )}
          {/* Library Status Badge */}
          {isInLibrary && libraryStatus && (
            <Badge
              className={`${STATUS_BADGE_COLORS[libraryStatus]} text-white border-black font-black uppercase tracking-widest text-[10px]`}
              size="xs"
              radius="xs"
            >
              {STATUS_LABELS[libraryStatus]}
            </Badge>
          )}
        </div>

        {/* Description with Expand/Collapse */}
        {item.overview && (
          <div className="space-y-1">
            <p
              className={`text-xs leading-relaxed opacity-80 font-mono transition-all duration-300 ${isExpanded ? '' : 'line-clamp-3'}`}
            >
              {item.overview}
            </p>
            {/* <button
              onClick={() => setIsExpanded(!isExpanded)}
              type="button"
              className="
                text-[10px] font-black uppercase tracking-widest
                flex items-center gap-1


                transition-opacity
                cursor-pointer
                underline
                w-full
                text-left
                py-1
                mt-1
              "
            > */}
            <Button
                onClick={() => setIsExpanded(!isExpanded)}
                className=" text-white border-black font-black uppercase tracking-wider text-[10px]"
                size="sm"
                color='black'
                variant='outline'
            
            >
              {isExpanded ? (
                <>
                  READ LESS
                  <ChevronUp size={10} strokeWidth={3} />
                </>
              ) : (
                <>
                  READ MORE
                  <ChevronDown size={10} strokeWidth={3} />
                </>
              )}
            </Button>
            {/* </button> */}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-auto space-y-2">
          {/* Add to Queue Button */}
          <Button
            fullWidth
            size="sm"
            color="black"
            className={`
              font-black uppercase tracking-wider text-[10px]
              ${isInQueue ? `bg-transparent ${colors.text} border-2 ${colors.border}` : 'bg-black text-white border-2 border-black'}
            `}
            radius="xs"
            leftSection={isInQueue ? <Check size={14} /> : <Plus size={14} />}
            onClick={() => !isInQueue && onAddToQueue(item)}
            disabled={isInQueue || isLoading}
            loading={isLoading}
          >
            {isInQueue ? 'IN QUEUE' : 'ADD TO QUEUE'}
          </Button>

          {/* Add to Library Button */}
          {onAddToLibrary && (
            <Button
              fullWidth
              size="sm"
              className={`
                font-black uppercase tracking-wider text-[10px]
                ${isInLibrary 
                  ? `bg-transparent ${colors.text} border-2 ${colors.border}` 
                  : 'bg-gray-700 text-white border-2 border-gray-700 hover:bg-gray-800'
                }
              `}
              radius="xs"
              leftSection={isInLibrary ? <Check size={14} /> : <BookOpen size={14} />}
              onClick={() => !isInLibrary && onAddToLibrary(item)}
              disabled={isInLibrary || isAddingToLibrary}
              loading={isAddingToLibrary}
            >
              {isInLibrary ? 'IN LIBRARY' : 'ADD TO LIBRARY'}
            </Button>
          )}
        </div>
      </div>

      {/* Bottom Border Accent */}
      <div className={`h-1 ${colors.border} bg-current opacity-20`} />
    </div>
  )
}

