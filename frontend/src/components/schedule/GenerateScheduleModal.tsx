import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Modal,
  Button,
  Stack,
  Select,
  Group,
  Text,
  Box,
  Radio,
  Collapse,
  Checkbox,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { DatePickerInput } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import { toast } from 'sonner';
import { getQueue, getEpisodesByContentId } from '../../api/content';
import { generateScheduleFromQueue } from '../../api/schedule';
import type { Episode, GenerateScheduleRequest, QueueItem } from '../../types/api';

interface SeasonSectionProps {
  seasonNum: number;
  seasonEpisodes: Episode[];
  allSeasonChecked: boolean;
  someSeasonChecked: boolean;
  filter: { mode: 'all' | 'include' | 'exclude'; episodes: string[] };
  showContentId: string;
  onToggleSeason: (contentId: string, seasonEpisodes: Episode[], checked: boolean) => void;
  onToggleEpisode: (contentId: string, season: number, episode: number, checked: boolean) => void;
}

function SeasonSection({
  seasonNum,
  seasonEpisodes,
  allSeasonChecked,
  someSeasonChecked,
  filter,
  showContentId,
  onToggleSeason,
  onToggleEpisode,
}: SeasonSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Box>
      <Button
        variant="subtle"
        size="md"
        onClick={() => setIsExpanded(!isExpanded)}
        leftSection={isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
        styles={{
          root: {
            fontWeight: 500,
            padding: '8px 12px',
            minHeight: '44px',
            width: '100%',
            justifyContent: 'flex-start',
          }
        }}
      >
        <Group justify="space-between" style={{ flex: 1 }}>
          <Text size="sm">Season {seasonNum}</Text>
          <Text size="xs" c="dimmed">
            {allSeasonChecked ? `All selected (${seasonEpisodes.length})` : someSeasonChecked ? `${filter.episodes.filter(key => seasonEpisodes.some(ep => key === `${ep.season}-${ep.episode_number}`)).length} selected` : `${seasonEpisodes.length} episodes`}
          </Text>
        </Group>
      </Button>
      <Collapse in={isExpanded}>
        <Box ml="md" mt="xs">
          <Button
            variant="subtle"
            size="sm"
            onClick={() => onToggleSeason(showContentId, seasonEpisodes, !allSeasonChecked)}
            styles={{
              root: {
                fontWeight: 400,
                fontSize: '13px',
                minHeight: '36px',
                padding: '8px 12px',
              }
            }}
            mb="xs"
          >
            {allSeasonChecked ? 'Deselect all' : someSeasonChecked ? 'Select all' : 'Select all'}
          </Button>
          <Stack gap={4}>
            {seasonEpisodes.map((ep) => {
              const key = `${ep.season}-${ep.episode_number}`;
              return (
                <Checkbox
                  key={ep.id}
                  size="sm"
                  label={`${ep.episode_number}. ${ep.title}`}
                  checked={filter.episodes.includes(key)}
                  onChange={(e) =>
                    onToggleEpisode(showContentId, ep.season, ep.episode_number, e.currentTarget.checked)
                  }
                  styles={{
                    root: { minHeight: '44px', display: 'flex', alignItems: 'center' },
                    label: { fontSize: '14px', cursor: 'pointer' },
                    input: { cursor: 'pointer' },
                  }}
                />
              );
            })}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}

interface GenerateScheduleModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ShowEpisodeFilterProps {
  show: QueueItem;
  isExpanded: boolean;
  filter: { mode: 'all' | 'include' | 'exclude'; episodes: string[] };
  onToggleShow: (contentId: string) => void;
  onToggleEpisode: (contentId: string, season: number, episode: number, checked: boolean) => void;
  onToggleSeason: (contentId: string, seasonEpisodes: Episode[], checked: boolean) => void;
  onFilterModeChange: (contentId: string, mode: 'all' | 'include' | 'exclude') => void;
}

function ShowEpisodeFilter({
  show,
  isExpanded,
  filter,
  onToggleShow,
  onToggleEpisode,
  onToggleSeason,
  onFilterModeChange,
}: ShowEpisodeFilterProps) {
  const { data: episodes = [], isLoading } = useQuery({
    queryKey: ['episodes', show.content_id, 'filters'],
    queryFn: () => getEpisodesByContentId(show.content_id),
    enabled: isExpanded,
  });

  // Group by season
  const seasons = episodes.reduce((acc, ep) => {
    if (!acc[ep.season]) acc[ep.season] = [];
    acc[ep.season].push(ep);
    return acc;
  }, {} as Record<number, Episode[]>);

  return (
    <Box style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
      <Group justify="space-between" mb="xs">
        <Button
          variant="subtle"
          size="md"
          onClick={() => onToggleShow(show.content_id)}
          leftSection={isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          styles={{
            root: {
              fontWeight: 400,
              padding: '8px 12px',
              minHeight: '44px',
            }
          }}
        >
          {show.title}
        </Button>
      </Group>

      <Collapse in={isExpanded}>
        <Stack gap="xs" ml="md">
          <Radio.Group
            value={filter.mode}
            onChange={(value) =>
              onFilterModeChange(show.content_id, value as 'all' | 'include' | 'exclude')
            }
            size="sm"
          >
            <Stack gap="xs">
              <Radio
                value="all"
                label="All episodes"
                styles={{
                  root: { minHeight: '44px', display: 'flex', alignItems: 'center' },
                  label: { fontSize: '14px', cursor: 'pointer' }
                }}
              />
              <Radio
                value="include"
                label="Include only these"
                styles={{
                  root: { minHeight: '44px', display: 'flex', alignItems: 'center' },
                  label: { fontSize: '14px', cursor: 'pointer' }
                }}
              />
              <Radio
                value="exclude"
                label="Skip these"
                styles={{
                  root: { minHeight: '44px', display: 'flex', alignItems: 'center' },
                  label: { fontSize: '14px', cursor: 'pointer' }
                }}
              />
            </Stack>
          </Radio.Group>

          {isLoading ? (
            <Text size="xs" c="dimmed">Loading...</Text>
          ) : Object.keys(seasons).length === 0 ? (
            <Text size="xs" c="dimmed">No episodes</Text>
          ) : (
            <Stack gap="md">
              {Object.entries(seasons)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([seasonNum, seasonEpisodes]) => {
                  const seasonKeys = seasonEpisodes.map((ep) => `${ep.season}-${ep.episode_number}`);
                  const allSeasonChecked = seasonKeys.every((key) => filter.episodes.includes(key));
                  const someSeasonChecked = seasonKeys.some((key) => filter.episodes.includes(key));

                  return (
                    <SeasonSection
                      key={seasonNum}
                      seasonNum={Number(seasonNum)}
                      seasonEpisodes={seasonEpisodes}
                      allSeasonChecked={allSeasonChecked}
                      someSeasonChecked={someSeasonChecked}
                      filter={filter}
                      showContentId={show.content_id}
                      onToggleSeason={onToggleSeason}
                      onToggleEpisode={onToggleEpisode}
                    />
                  );
                })}
            </Stack>
          )}
        </Stack>
      </Collapse>
    </Box>
  );
}

export function GenerateScheduleModal({ opened, onClose }: GenerateScheduleModalProps) {
  const queryClient = useQueryClient();
  const today = new Date();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [scheduleDate, setScheduleDate] = useState<Date | null>(today);
  const [startTimeBlock, setStartTimeBlock] = useState('20:00'); // Prime time default
  const [duration, setDuration] = useState('180'); // 3 hours in minutes
  const [rotationType, setRotationType] = useState<'round_robin' | 'random' | 'round_robin_double'>('round_robin');
  const [useCustomTimeRange, setUseCustomTimeRange] = useState(false);
  const [customStartTime, setCustomStartTime] = useState('20:00');
  const [customEndTime, setCustomEndTime] = useState('23:00');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedShows, setExpandedShows] = useState<string[]>([]);
  const [episodeFilters, setEpisodeFilters] = useState<Record<
    string,
    { mode: 'all' | 'include' | 'exclude'; episodes: string[] }
  >>({});

  // Network-style time slots
  const timeBlocks = [
    { value: '06:00', label: 'Early Morning (6:00 AM)' },
    { value: '09:00', label: 'Morning (9:00 AM)' },
    { value: '12:00', label: 'Midday (12:00 PM)' },
    { value: '15:00', label: 'Afternoon (3:00 PM)' },
    { value: '17:00', label: 'Early Evening (5:00 PM)' },
    { value: '20:00', label: 'Prime Time (8:00 PM)' },
    { value: '23:00', label: 'Late Night (11:00 PM)' },
  ];

  // Get user's timezone info
  const timezoneAbbr = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() || 'Local';

  const timeOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const period = hour >= 12 ? 'PM' : 'AM';
        const label = `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
        options.push({ value, label });
      }
    }
    return options;
  }, []);

  // Fetch queue for episode filters
  const { data: queue } = useQuery({
    queryKey: ['queue'],
    queryFn: getQueue,
    enabled: opened && showFilters,
  });

  const shows = useMemo(
    () => (queue || []).filter((item) => item.content_type === 'show' && item.content_id),
    [queue]
  );

  const getFilter = (contentId: string) => {
    return episodeFilters[contentId] || { mode: 'all', episodes: [] };
  };

  const toggleEpisode = (contentId: string, season: number, episode: number, checked: boolean) => {
    const filter = getFilter(contentId);
    const key = `${season}-${episode}`;
    const episodes = checked
      ? [...filter.episodes, key]
      : filter.episodes.filter((entry) => entry !== key);
    setEpisodeFilters((prev) => ({
      ...prev,
      [contentId]: { ...filter, episodes },
    }));
  };

  const toggleSeason = (contentId: string, seasonEpisodes: Episode[], checked: boolean) => {
    const filter = getFilter(contentId);
    const seasonKeys = seasonEpisodes.map((ep) => `${ep.season}-${ep.episode_number}`);
    const episodes = checked
      ? Array.from(new Set([...filter.episodes, ...seasonKeys]))
      : filter.episodes.filter((key) => !seasonKeys.includes(key));
    setEpisodeFilters((prev) => ({
      ...prev,
      [contentId]: { ...filter, episodes },
    }));
  };

  const toggleShow = (contentId: string) => {
    setExpandedShows((prev) =>
      prev.includes(contentId) ? prev.filter((id) => id !== contentId) : [...prev, contentId]
    );
  };

  // Calculate end time based on start time + duration
  const calculateEndTime = (startTime: string, durationMinutes: string): string => {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = startMinutes + Number(durationMinutes);
    const endHour = Math.floor(endMinutes / 60) % 24;
    const endMinute = endMinutes % 60;

    return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
  };

  const formatStartTime = (time24: string): string => {
    const [hour, minute] = time24.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
  };

  const calculatedEndTime = calculateEndTime(startTimeBlock, duration);
  const formattedStartTime = formatStartTime(useCustomTimeRange ? customStartTime : startTimeBlock);
  const formattedEndTime = formatStartTime(useCustomTimeRange ? customEndTime : calculatedEndTime);

  // Format date for modal title - recalculate whenever scheduleDate changes
  const formattedDate = useMemo(() => {
    if (!scheduleDate || !(scheduleDate instanceof Date)) return 'Select Date';
    return scheduleDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }, [scheduleDate]);

  const generateMutation = useMutation({
    mutationFn: (params: GenerateScheduleRequest) => generateScheduleFromQueue(params),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      
      if (data.skippedItems && data.skippedItems.length > 0) {
        // Group skipped items by content for succinct display
        const skippedGrouped = data.skippedItems.reduce((acc, item) => {
          const key = item.content_title || item.content_id;
          if (!acc[key]) {
            acc[key] = {
              title: item.content_title || 'Unknown',
              count: 0,
            };
          }
          acc[key].count++;
          return acc;
        }, {} as Record<string, { title: string; count: number }>);
        
        // Group successfully scheduled items by content
        const scheduledGrouped = (data.schedule || []).reduce((acc, item) => {
          const key = item.title || item.content_id;
          if (!acc[key]) {
            acc[key] = {
              title: item.title || 'Unknown',
              count: 0,
            };
          }
          acc[key].count++;
          return acc;
        }, {} as Record<string, { title: string; count: number }>);
        
        // Build succinct messages
        const skippedList = Object.values(skippedGrouped)
          .map(group => `${group.title}${group.count > 1 ? ` (${group.count})` : ''}`)
          .join(', ');
        
        const scheduledList = Object.values(scheduledGrouped)
          .map(group => `${group.title}${group.count > 1 ? ` (${group.count})` : ''}`)
          .join(', ');
        
        const scheduledCount = data.schedule?.length || 0;
        const skippedCount = data.skippedItems.length;
        
        // Build description with both scheduled and skipped items
        let description = '';
        if (scheduledCount > 0) {
          description = `✅ Scheduled (${scheduledCount}): ${scheduledList}`;
          if (skippedCount > 0) {
            description += `\n❌ Skipped (${skippedCount}): ${skippedList}`;
          }
        } else {
          description = `❌ Skipped (${skippedCount}): ${skippedList}`;
        }
        description += '\n\n💡 To schedule skipped items:\n  • Go to Schedule tab and delete conflicting items, or\n  • Choose a longer duration or different start time';
        
        const conflictMessage = scheduledCount > 0 
          ? `Schedule generated: ${scheduledCount} scheduled, ${skippedCount} skipped`
          : `${skippedCount} item${skippedCount !== 1 ? 's' : ''} could not be scheduled`;
        
        // Show warning toast with manual dismiss option
        toast.warning(conflictMessage, {
          duration: Infinity, // Don't auto-dismiss - user must manually close
          description: description,
          dismissible: true, // Explicitly enable close button
        });
      } else {
        // Show success if everything scheduled
        toast.success(data.message || `Schedule generated! ${data.schedule?.length || 0} items created.`);
        onClose();
        // Stay on current page to show what was scheduled
      }
    },
    onError: (error: Error) => {
      console.error('Schedule generation error:', error);
      toast.error(error.message || 'Failed to generate schedule');
    },
  });
  
  const handleClose = () => {
    onClose();
  };

  const handleGenerate = () => {
    if (!scheduleDate) {
      toast.error('Please select a date');
      return;
    }

    const startTimeValue = useCustomTimeRange ? customStartTime : startTimeBlock;
    const endTimeValue = useCustomTimeRange ? customEndTime : calculateEndTime(startTimeBlock, duration);

    // Format dates as YYYY-MM-DD (using local date to preserve the calendar date selected)
    const formatDate = (date: Date | null | string): string => {
      if (!date) return '';
      
      // If already a string in YYYY-MM-DD format, return it directly
      if (typeof date === 'string') {
        // Validate format
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return date;
        }
        // Otherwise parse it
        const dateObj = new Date(date + 'T12:00:00'); // Add noon to avoid timezone issues
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      // Convert to Date if needed
      const dateObj = date instanceof Date ? date : new Date(date);
      
      if (isNaN(dateObj.getTime())) {
        console.error('Invalid date:', date);
        return '';
      }
      
      // Extract the local calendar date components
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const formatted = `${year}-${month}-${day}`;
      
      return formatted;
    };

    const formattedDate = formatDate(scheduleDate);

    console.log('Schedule generation params:', {
      scheduleDate,
      formattedDate,
      startTime: startTimeValue,
      endTime: endTimeValue,
      duration,
    });

    // Get user's timezone offset (e.g., "-05:00" for EST, "+00:00" for UTC)
    const getTimezoneOffset = (): string => {
      const date = new Date();
      const offsetMinutes = -date.getTimezoneOffset(); // Negative because we want offset from UTC
      const sign = offsetMinutes >= 0 ? '+' : '-';
      const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
      const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
      return `${sign}${hours}:${minutes}`;
    };

    const params: GenerateScheduleRequest = {
      start_date: formattedDate,
      end_date: formattedDate, // Same date for single-day scheduling
      start_time: startTimeValue,
      end_time: endTimeValue,
      timezone_offset: getTimezoneOffset(), // Send user's current timezone
      rotation_type: rotationType as 'round_robin' | 'random',
    };

    // Add episode filters if any are set
    const filters: GenerateScheduleRequest['episode_filters'] = {};
    Object.entries(episodeFilters).forEach(([contentId, filter]) => {
      const hasSelections = filter.episodes.length > 0;
      if (filter.mode !== 'all' && hasSelections) {
        filters[contentId] = {
          mode: filter.mode,
          episodes: filter.episodes.map((entry) => {
            const [season, episode] = entry.split('-').map(Number);
            return { season, episode };
          }),
        };
      }
    });

    if (Object.keys(filters).length > 0) {
      params.episode_filters = filters;
    }

    console.log('Generating schedule with params:', params);
    generateMutation.mutate(params);
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={`Schedule for ${formattedDate}`}
      size="md"
      closeOnClickOutside={true}
      styles={{
        title: {
          fontSize: '20px',
          fontWeight: 500,
          color: '#111827',
        },
        body: {
          maxHeight: isMobile ? 'calc(100vh - 120px)' : '70vh',
          overflowY: 'auto',
        },
      }}
      fullScreen={isMobile}
    >
      <Stack gap="lg">
        {/* Timezone info */}
        <Text size="sm" c="dimmed" fw={300}>
          Times shown in <strong style={{ fontWeight: 500 }}>{timezoneAbbr}</strong>
        </Text>

        {/* Date */}
        <DatePickerInput
          label="Date"
          placeholder="Pick a date"
          value={scheduleDate}
          onChange={(date) => {
            setScheduleDate(date as Date | null);
          }}
          required
          styles={{
            label: { fontSize: '14px', fontWeight: 500, color: '#111827', marginBottom: '6px' },
          }}
        />

        {/* Time Block */}
        <Stack gap="sm">
          <Text size="sm" fw={500} c="#111827">
            Time Block
          </Text>
          <Select
            label="Start time"
            value={startTimeBlock}
            onChange={(value) => setStartTimeBlock(value || '20:00')}
            data={timeBlocks}
            required
            disabled={useCustomTimeRange}
            styles={{
              label: { fontSize: '14px', fontWeight: 400, color: '#6b7280', marginBottom: '4px' },
            }}
          />

          <Select
            label="How much time do you want to dedicate?"
            value={duration}
            onChange={(value) => setDuration(value || '180')}
            data={[
              { value: '30', label: '30 minutes' },
              { value: '60', label: '1 hour' },
              { value: '90', label: '1.5 hours' },
              { value: '120', label: '2 hours' },
              { value: '150', label: '2.5 hours' },
              { value: '180', label: '3 hours' },
            ]}
            required
            disabled={useCustomTimeRange}
            styles={{
              label: { fontSize: '14px', fontWeight: 400, color: '#6b7280', marginBottom: '4px' },
            }}
          />

          <Radio.Group
            value={useCustomTimeRange ? 'custom' : 'preset'}
            onChange={(value) => setUseCustomTimeRange(value === 'custom')}
            size="sm"
          >
            <Stack gap="xs">
              <Radio
                value="preset"
                label="Use preset time block"
                styles={{
                  root: { minHeight: '44px', display: 'flex', alignItems: 'center' },
                  label: { fontSize: '14px', cursor: 'pointer' }
                }}
              />
              <Radio
                value="custom"
                label="Custom time range"
                styles={{
                  root: { minHeight: '44px', display: 'flex', alignItems: 'center' },
                  label: { fontSize: '14px', cursor: 'pointer' }
                }}
              />
            </Stack>
          </Radio.Group>

          {useCustomTimeRange && (
            <Group grow>
              <Select
                label="Custom start"
                value={customStartTime}
                onChange={(value) => setCustomStartTime(value || '20:00')}
                data={timeOptions}
                searchable
              />
              <Select
                label="Custom end"
                value={customEndTime}
                onChange={(value) => setCustomEndTime(value || '23:00')}
                data={timeOptions}
                searchable
              />
            </Group>
          )}

          {/* Show calculated time range */}
          <Box
            style={{
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              padding: '12px 14px',
              marginTop: '8px',
            }}
          >
            <Group gap="xs" justify="center">
              <Text size="sm" fw={500} c="#111827">
                {formattedStartTime}
              </Text>
              <Text size="sm" c="#9ca3af">
                →
              </Text>
              <Text size="sm" fw={500} c="#111827">
                {formattedEndTime}
              </Text>
              {!useCustomTimeRange && (
                <Text size="xs" c="#6b7280" style={{ marginLeft: '8px' }}>
                  ({duration} min)
                </Text>
              )}
            </Group>
          </Box>
        </Stack>

        {/* Options */}
        <Stack gap="sm">
          <Text size="sm" fw={500} c="#111827">
            Options
          </Text>

          <Radio.Group
            label="Selection Mode"
            description="How to select episodes from your lineup"
            value={rotationType}
            onChange={(value) => setRotationType(value as 'round_robin' | 'random')}
            size="sm"
          >
            <Stack gap="xs" mt="xs">
              <Radio
                value="round_robin"
                label="Sequential - Play shows in lineup order"
                description="Cycles through your lineup in order, one episode at a time"
                styles={{
                  root: { minHeight: '44px', display: 'flex', alignItems: 'flex-start', paddingTop: '8px' },
                  label: { fontSize: '14px', cursor: 'pointer', fontWeight: 500 },
                  description: { fontSize: '12px', color: '#9ca3af', marginTop: '2px' },
                }}
              />
              <Radio
                value="random"
                label="Random - Shuffle all episodes"
                description="Randomly selects episodes from any show in your lineup"
                styles={{
                  root: { minHeight: '44px', display: 'flex', alignItems: 'flex-start', paddingTop: '8px' },
                  label: { fontSize: '14px', cursor: 'pointer', fontWeight: 500 },
                  description: { fontSize: '12px', color: '#9ca3af', marginTop: '2px' },
                }}
              />
            </Stack>
          </Radio.Group>
        </Stack>

        {/* Episode Filters - Collapsible */}
        <Box>
          <Button
            variant="subtle"
            size="md"
            onClick={() => setShowFilters(!showFilters)}
            leftSection={showFilters ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
            styles={{
              root: {
                fontWeight: 400,
                color: '#6b7280',
                minHeight: '44px',
                padding: '12px 16px',
              }
            }}
          >
            Advanced: Filter episodes {showFilters ? '' : `(${shows.length || 0} shows)`}
          </Button>

          <Collapse in={showFilters}>
            <Stack gap="md" mt="sm">
              {shows.length === 0 ? (
                <Text size="sm" c="dimmed">No shows in Lineup</Text>
              ) : (
                shows.map((show) => (
                  <ShowEpisodeFilter
                    key={show.content_id}
                    show={show}
                    isExpanded={expandedShows.includes(show.content_id)}
                    filter={getFilter(show.content_id)}
                    onToggleShow={toggleShow}
                    onToggleEpisode={toggleEpisode}
                    onToggleSeason={toggleSeason}
                    onFilterModeChange={(contentId, mode) => {
                      const filter = getFilter(contentId);
                      setEpisodeFilters((prev) => ({
                        ...prev,
                        [contentId]: { ...filter, mode },
                      }));
                    }}
                  />
                ))
              )}
            </Stack>
          </Collapse>
        </Box>

        <Group justify="flex-end" mt="md" gap="sm">
          <Button
            variant="subtle"
            color="gray"
            size="md"
            onClick={handleClose}
            styles={{
              root: {
                fontWeight: 400,
                minHeight: '44px',
                padding: '12px 20px',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            size="md"
            onClick={handleGenerate}
            loading={generateMutation.isPending}
            styles={{
              root: {
                backgroundColor: '#14b8a6',
                fontWeight: 400,
                minHeight: '44px',
                padding: '12px 20px',
                '&:hover': {
                  backgroundColor: '#0d9488',
                },
              },
            }}
          >
            Generate Schedule
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
