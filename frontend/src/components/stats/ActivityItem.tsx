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
        return <span className="bg-cyan-200 text-gray-900 px-2 py-1 text-[10px] font-black tracking-widest">WATCHING</span>;
      case 'completed':
        return <span className="bg-green-200 text-gray-900 px-2 py-1 text-[10px] font-black tracking-widest">COMPLETED</span>;
      case 'dropped':
        return <span className="bg-rose-200 text-gray-900 px-2 py-1 text-[10px] font-black tracking-widest">DROPPED</span>;
      case 'plan_to_watch':
        return <span className="bg-yellow-200 text-gray-900 px-2 py-1 text-[10px] font-black tracking-widest">PLANNED</span>;
      default:
        return null;
    }
  };

  const timeAgo = timestamp ? formatDistanceToNow(new Date(timestamp), { addSuffix: true }) : 'Unknown';

  return (
    <div className="flex items-center gap-3 py-3 border-b-2 border-gray-200 last:border-0">
      {/* Poster */}
      {posterUrl && (
        <img
          src={posterUrl}
          alt={title}
          className="w-12 h-18 object-cover border-2 border-gray-900"
        />
      )}
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm truncate mb-1">
          {title}
        </h4>
        <div className="flex items-center gap-2">
          {getStatusBadge(status)}
          <span className="text-xs text-gray-600 font-mono">
            {contentType === 'show' ? 'TV' : 'MOVIE'}
          </span>
        </div>
      </div>
      
      {/* Timestamp */}
      <div className="text-xs text-gray-500 font-mono">
        {timeAgo}
      </div>
    </div>
  );
}


