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

const STATUS_BADGE_COLORS: Record<LibraryStatus, string> = {
  watching: 'bg-blue-500/90',
  completed: 'bg-green-500/90',
  dropped: 'bg-red-500/90',
  plan_to_watch: 'bg-gray-500/90',
}

const STATUS_LABELS: Record<LibraryStatus, string> = {
  watching: 'Watching',
  completed: 'Completed',
  dropped: 'Dropped',
  plan_to_watch: 'Plan to Watch',
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

  // Determine which title to display based on preference
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
    <div className="bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm dark:shadow-gray-950/50 hover:shadow-xl dark:hover:shadow-gray-950/80 hover:-translate-y-1 transition-all duration-300 ease-out flex flex-col h-full">
      {/* Poster Image */}
      <div className="relative w-full aspect-[2/3] overflow-hidden rounded-t-lg bg-[rgb(var(--color-bg-elevated))] dark:bg-gray-800">
        {item.poster_url ? (
          <img
            src={item.poster_url}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-[rgb(var(--color-text-tertiary))]">
            NO IMAGE
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Title */}
        <h3 className="text-base md:text-lg font-semibold leading-tight text-[rgb(var(--color-text-primary))] line-clamp-2">
          {displayTitle}
        </h3>

        {/* Type Badge, Year, and Rating */}
        <div className="flex gap-2 items-center flex-wrap">
          <Badge
            className="font-semibold text-xs"
            size="sm"
            variant="light"
            color="gray"
          >
            {item.content_type === 'movie' ? 'Film' : 'Series'}
          </Badge>
          {/* Year Badge */}
          {item.release_date && (
            <Badge
              className="font-semibold text-xs"
              size="sm"
              variant="light"
              color="gray"
            >
              {new Date(item.release_date).getFullYear()}
            </Badge>
          )}
          {/* Rating Badge */}
          {normalizeRating(item.rating) && (
            <Badge
              className="font-semibold text-xs"
              size="sm"
              variant="light"
              color="gray"
            >
              {normalizeRating(item.rating)}
            </Badge>
          )}
          {/* Library Status Badge */}
          {isInLibrary && libraryStatus && (
            <Badge
              className={`${STATUS_BADGE_COLORS[libraryStatus]} text-white font-semibold text-xs shadow-sm`}
              size="sm"
              radius="md"
            >
              {STATUS_LABELS[libraryStatus]}
            </Badge>
          )}
        </div>

        {/* Description with Expand/Collapse */}
        {item.overview && (
          <div className="space-y-1">
            <p className={`text-xs leading-relaxed text-[rgb(var(--color-text-secondary))] transition-all duration-300 ${isExpanded ? '' : 'line-clamp-3'}`}>
              {item.overview}
            </p>
            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              className="font-semibold text-xs"
              size="xs"
              variant='subtle'
              color='gray'
            >
              {isExpanded ? (
                <>
                  Read Less
                  <ChevronUp size={12} />
                </>
              ) : (
                <>
                  Read More
                  <ChevronDown size={12} />
                </>
              )}
            </Button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-auto space-y-2">
          {/* Add to Queue Button */}
          <Button
            fullWidth
            size="sm"
            className={`font-semibold ${isInQueue ? '' : 'shadow-sm hover:shadow-lg'}`}
            variant={isInQueue ? 'light' : 'filled'}
            color={isInQueue ? 'gray' : 'blue'}
            leftSection={isInQueue ? <Check size={14} /> : <Plus size={14} />}
            onClick={() => !isInQueue && onAddToQueue(item)}
            disabled={isInQueue || isLoading}
            loading={isLoading}
          >
            {isInQueue ? 'In Queue' : 'Add to Queue'}
          </Button>

          {/* Add to Library Button */}
          {onAddToLibrary && (
            <Button
              fullWidth
              size="sm"
              className={`font-semibold ${isInLibrary ? '' : 'shadow-sm hover:shadow-lg'}`}
              variant={isInLibrary ? 'light' : 'filled'}
              color={isInLibrary ? 'gray' : 'violet'}
              leftSection={isInLibrary ? <Check size={14} /> : <BookOpen size={14} />}
              onClick={() => !isInLibrary && onAddToLibrary(item)}
              disabled={isInLibrary || isAddingToLibrary}
              loading={isAddingToLibrary}
            >
              {isInLibrary ? 'In Library' : 'Add to Library'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
