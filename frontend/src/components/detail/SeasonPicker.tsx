import { useLocation } from 'wouter';
import { animeHref } from '../../utils/contentHref';
import type { TitleSeason } from '../../types/titleDetail';
import { SeasonTabs } from '../library/SeasonTabs';

/**
 * Anime keep each season as its own entry, so these tabs hop between pages
 * rather than filtering one list. Same look as the episode tracker's seasons.
 */
export function SeasonPicker({ seasons, currentMalId }: { seasons: TitleSeason[]; currentMalId: number | null }) {
  const [, setLocation] = useLocation();

  return (
    <div className="mb-4">
      <SeasonTabs
        tabs={seasons.map((s) => ({
          key: s.mal_id,
          label: s.label,
          title: s.episodes != null ? `${s.episodes} episode${s.episodes === 1 ? '' : 's'}` : 'Upcoming',
        }))}
        activeKey={currentMalId ?? -1}
        onSelect={(malId) => {
          if (malId === currentMalId) return;
          setLocation(animeHref(Number(malId)));
          window.scrollTo({ top: 0 });
        }}
      />
    </div>
  );
}
