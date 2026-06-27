import { Modal } from '@mantine/core';
import { Calendar, Hash } from 'lucide-react';
import { formatFullDate } from '../../utils/format';
import { Button } from '../common/Button';

interface EpisodeDetailModalProps {
  opened: boolean;
  onClose: () => void;
  episode: {
    episode_number: number;
    title: string | null;
    overview: string | null;
    air_date: string | null;
    season: number;
  } | null;
}

export function EpisodeDetailModal({
  opened,
  onClose,
  episode,
}: EpisodeDetailModalProps) {
  if (!episode) return null;

  const episodeTitle = episode.title || `Episode ${episode.episode_number}`;
  const formattedAirDate = episode.air_date ? formatFullDate(episode.air_date) : null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <span className="text-base font-medium text-[rgb(var(--color-text-primary))]">
          Episode Details
        </span>
      }
      centered
      size="lg"
      radius="md"
      padding="xl"
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[rgb(var(--color-text-primary))] mb-3">
            {episodeTitle}
          </h2>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[rgb(var(--color-text-secondary))]">
            <span className="inline-flex items-center gap-1">
              <Hash size={14} /> Season {episode.season}, Episode {episode.episode_number}
            </span>
            {formattedAirDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar size={14} /> {formattedAirDate}
              </span>
            )}
          </div>
        </div>

        <div className="bg-[rgb(var(--color-bg-page))] p-4 rounded-lg border border-[rgb(var(--color-border-default))]">
          <p className="text-xs font-medium text-[rgb(var(--color-text-tertiary))] mb-2">
            Synopsis
          </p>
          <p className="text-[15px] leading-relaxed text-[rgb(var(--color-text-primary))]">
            {episode.overview || 'No description available for this episode.'}
          </p>
        </div>

        <div className="flex justify-end">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}


