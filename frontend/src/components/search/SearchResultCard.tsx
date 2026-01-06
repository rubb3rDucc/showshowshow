import { Star, Tv } from 'lucide-react'
import type { SearchResult } from '../../types/api'
import type { LibraryStatus } from '../../types/library.types'
import { normalizeRating } from '../../utils/rating'

interface SearchResultCardProps {
  item: SearchResult
  onClick: () => void
  isInQueue?: boolean
  titlePreference?: 'english' | 'japanese' | 'romanji'
  isInLibrary?: boolean
  libraryStatus?: LibraryStatus | null
}

const STATUS_COLORS: Record<LibraryStatus, string> = {
  watching: 'rgba(59, 130, 246, 0.3)',
  completed: 'rgba(34, 197, 94, 0.3)',
  dropped: 'rgba(239, 68, 68, 0.3)',
  plan_to_watch: 'rgba(107, 114, 128, 0.3)',
}

const STATUS_HOVER_COLORS: Record<LibraryStatus, string> = {
  watching: 'rgba(59, 130, 246, 0.6)',
  completed: 'rgba(34, 197, 94, 0.6)',
  dropped: 'rgba(239, 68, 68, 0.6)',
  plan_to_watch: 'rgba(107, 114, 128, 0.6)',
}

const STATUS_LABELS: Record<LibraryStatus, string> = {
  watching: 'Watching',
  completed: 'Completed',
  dropped: 'Dropped',
  plan_to_watch: 'Plan to Watch',
}

const STATUS_BADGE_COLORS: Record<LibraryStatus, { bg: string; text: string }> = {
  watching: { bg: 'bg-blue-500/90', text: 'text-white' },
  completed: { bg: 'bg-green-500/90', text: 'text-white' },
  dropped: { bg: 'bg-red-500/90', text: 'text-white' },
  plan_to_watch: { bg: 'bg-gray-500/90', text: 'text-white' },
}

export function SearchResultCard({
  item,
  onClick,
  titlePreference = 'english',
  isInLibrary = false,
  libraryStatus = null,
}: SearchResultCardProps) {
  // Determine which title to display
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

  const borderColor = isInLibrary && libraryStatus
    ? STATUS_COLORS[libraryStatus]
    : 'rgba(107, 114, 128, 0.3)'

  const hoverBorderColor = isInLibrary && libraryStatus
    ? STATUS_HOVER_COLORS[libraryStatus]
    : 'rgba(107, 114, 128, 0.6)'

  return (
    <div className="cursor-pointer group" onClick={onClick}>
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-lg
                   bg-gray-100
                   shadow-sm hover:shadow-xl
                   transition-all duration-300 ease-out
                   hover:-translate-y-1
                   border-2"
        style={{ borderColor }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = hoverBorderColor
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = borderColor
        }}
      >
        {item.poster_url ? (
          <img
            src={item.poster_url}
            alt={displayTitle || ''}
            className="w-full h-full object-cover
                       transition-transform duration-500 ease-out
                       group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <Tv className="w-12 h-12 text-gray-400" />
          </div>
        )}

        {/* Library Status Badge - Top Left */}
        {isInLibrary && libraryStatus && (
          <div className="absolute top-2 left-2">
            <div
              className={`
                px-2 py-0.5 rounded-md
                ${STATUS_BADGE_COLORS[libraryStatus].bg}
                ${STATUS_BADGE_COLORS[libraryStatus].text}
                backdrop-blur-md
                text-[10px] font-medium
                shadow-lg
              `}
            >
              {STATUS_LABELS[libraryStatus]}
            </div>
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="mt-3 space-y-1.5">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug group-hover:text-gray-700 transition-colors">
          {displayTitle}
        </h3>

        <div className="flex items-center gap-2 text-xs text-[rgb(var(--color-text-tertiary))]">
          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
            {item.content_type === 'movie' ? 'Film' : 'TV'}
          </span>

          {item.release_date && (
            <>
              <span className="text-gray-300">•</span>
              <span className="font-medium">
                {new Date(item.release_date).getFullYear()}
              </span>
            </>
          )}

          {normalizeRating(item.rating) && (
            <>
              <span className="text-gray-300">•</span>
              <span className="font-medium">{normalizeRating(item.rating)}</span>
            </>
          )}

          {item.vote_average && (
            <>
              <span className="text-gray-300">•</span>
              <div className="flex items-center gap-0.5">
                <Star size={10} fill="currentColor" className="text-amber-500" />
                <span className="font-medium">{item.vote_average.toFixed(1)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
