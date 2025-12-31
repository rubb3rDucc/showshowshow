import { Lightbulb } from 'lucide-react';

interface InsightsCardProps {
  completionRate: number;
  totalWatchTimeHours: number;
  totalEpisodesWatched: number;
}

export function InsightsCard({ completionRate, totalWatchTimeHours, totalEpisodesWatched }: InsightsCardProps) {
  return (
    <div className="bg-white border-2 border-gray-900 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-gray-900 text-white px-2 py-1 text-[10px] font-black tracking-widest">
          INSIGHTS
        </div>
        <Lightbulb size={20} strokeWidth={2.5} className="text-gray-700" />
        <span className="text-lg font-black uppercase tracking-wider">
          Viewing Insights
        </span>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between py-3 border-b-2 border-gray-200">
          <span className="text-sm font-bold uppercase tracking-wide">Completion Rate</span>
          <span className="text-2xl font-black tracking-tight">{completionRate}%</span>
        </div>

        <div className="flex items-center justify-between py-3 border-b-2 border-gray-200">
          <span className="text-sm font-bold uppercase tracking-wide">Total Watch Time</span>
          <span className="text-2xl font-black tracking-tight">{totalWatchTimeHours}h</span>
        </div>

        <div className="flex items-center justify-between py-3">
          <span className="text-sm font-bold uppercase tracking-wide">Episodes Watched</span>
          <span className="text-2xl font-black tracking-tight">{totalEpisodesWatched}</span>
        </div>
      </div>
    </div>
  );
}

