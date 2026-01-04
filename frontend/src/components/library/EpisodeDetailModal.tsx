import { Modal, Text, Group, Badge } from '@mantine/core';
import { Calendar, Hash } from 'lucide-react';

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
  const formattedAirDate = episode.air_date
    ? new Date(episode.air_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={700} size="lg">
          Episode Details
        </Text>
      }
      centered
      size="lg"
      radius="md"
      padding="xl"
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[rgb(var(--color-text-primary))] mb-2">
            {episodeTitle}
          </h2>

          <Group gap="xs" className="mb-4">
            <Badge
              size="lg"
              radius="sm"
              color="gray"
              variant="light"
              leftSection={<Hash size={14} />}
            >
              Season {episode.season}, Episode {episode.episode_number}
            </Badge>
            {formattedAirDate && (
              <Badge
                size="lg"
                radius="sm"
                color="gray"
                variant="light"
                leftSection={<Calendar size={14} />}
              >
                {formattedAirDate}
              </Badge>
            )}
          </Group>
        </div>

        <div className="bg-[rgb(var(--color-bg-page))] p-4 rounded-md border border-gray-100">
          <Text size="sm" c="dimmed" fw={600} mb="xs">
            Synopsis
          </Text>
          <Text className="leading-relaxed text-gray-700">
            {episode.overview || 'No description available for this episode.'}
          </Text>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 text-white font-bold rounded hover:bg-gray-800 transition-colors text-sm tracking-wide"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}


