import { formatDistanceToNow } from 'date-fns';

interface ActivityItemProps {
  title: string;
  posterUrl: string | null;
  contentType: 'show' | 'movie';
  status: string;
  timestamp: string | null;
}

export function ActivityItem({ title, posterUrl, contentType, status, timestamp }: ActivityItemProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'watching':
        return <span className="bg-blue-500/90 text-white px-2 py-1 text-xs font-semibold rounded-md shadow-sm">Watching</span>;
      case 'completed':
        return <span className="bg-green-500/90 text-white px-2 py-1 text-xs font-semibold rounded-md shadow-sm">Completed</span>;
      case 'dropped':
        return <span className="bg-red-500/90 text-white px-2 py-1 text-xs font-semibold rounded-md shadow-sm">Dropped</span>;
      case 'plan_to_watch':
        return <span className="bg-[rgb(var(--color-bg-page))]0/90 text-white px-2 py-1 text-xs font-semibold rounded-md shadow-sm">Planned</span>;
      default:
        return null;
    }
  };

  const timeAgo = timestamp ? formatDistanceToNow(new Date(timestamp), { addSuffix: true }) : 'Unknown';

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[rgb(var(--color-border-subtle))] last:border-0">
      {/* Poster */}
      {posterUrl && (
        <img
          src={posterUrl}
          alt={title}
          className="w-12 h-18 object-cover rounded-md border border-[rgb(var(--color-border-default))] shadow-sm dark:shadow-gray-950/50"
        />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm text-[rgb(var(--color-text-primary))] truncate mb-1">
          {title}
        </h4>
        <div className="flex items-center gap-2">
          {getStatusBadge(status)}
          <span className="text-xs text-[rgb(var(--color-text-tertiary))] font-normal">
            {contentType === 'show' ? 'TV' : 'Movie'}
          </span>
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-xs text-[rgb(var(--color-text-tertiary))] font-normal">
        {timeAgo}
      </div>
    </div>
  );
}
