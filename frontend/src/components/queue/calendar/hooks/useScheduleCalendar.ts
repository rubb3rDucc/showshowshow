import { useState, useMemo } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSchedule, createScheduleItem, deleteScheduleItem } from '../../../../api/schedule';
import { getQueue, getEpisodes } from '../../../../api/content';
import type { QueueItem, Episode, ScheduleItem } from '../../../../types/api';
import type { TimeSlot, PendingScheduleItem, HoveredTime, SchedulingMode } from '../types';
import {
  formatDate,
  toDate,
  isTimeRangeOccupied,
  getOccupiedErrorMessage,
  getTimeFromPosition,
  getAvailableDuration,
} from '../utils';

export function useScheduleCalendar(expanded: boolean) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [scheduleModalOpened, setScheduleModalOpened] = useState(false);
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);
  const [selectedEpisodes, setSelectedEpisodes] = useState<Map<string, { season: number; episode: number }>>(new Map());
  const [pendingItems, setPendingItems] = useState<Map<string, PendingScheduleItem>>(new Map());
  const [hoveredTime, setHoveredTime] = useState<HoveredTime | null>(null);
  const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>('sequential');

  const dateStr = formatDate(selectedDate);

  // Fetch schedule for selected date
  const { data: schedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ['schedule', dateStr || 'all'],
    queryFn: () => getSchedule(dateStr),
    enabled: !!dateStr && expanded,
  });

  // Fetch queue items
  const { data: queue, isLoading: queueLoading } = useQuery({
    queryKey: ['queue'],
    queryFn: getQueue,
    enabled: expanded,
  });

  // Fetch episodes when a show is selected
  const { data: episodes, isLoading: episodesLoading } = useQuery({
    queryKey: ['episodes', selectedQueueItem?.tmdb_id],
    queryFn: () => getEpisodes(selectedQueueItem!.tmdb_id!),
    enabled: !!selectedQueueItem && selectedQueueItem.content_type === 'show' && !!selectedQueueItem.tmdb_id,
  });

  // Get unique shows from schedule to fetch episode titles
  const scheduleShows = useMemo(() => {
    if (!schedule) return [];
    const shows = new Map<string, { content_id: string; tmdb_id: number }>();
    schedule.forEach(item => {
      if (item.content_type === 'show' && item.tmdb_id && item.season !== null && item.episode !== null) {
        if (!shows.has(item.content_id)) {
          shows.set(item.content_id, { content_id: item.content_id, tmdb_id: item.tmdb_id });
        }
      }
    });
    return Array.from(shows.values());
  }, [schedule]);

  // Fetch episodes for all scheduled shows in parallel using useQueries
  const scheduleEpisodesQueries = useQueries({
    queries: scheduleShows.map(show => ({
      queryKey: ['episodes', show.tmdb_id, 'schedule'],
      queryFn: () => getEpisodes(show.tmdb_id),
      enabled: expanded && !!show.tmdb_id,
    })),
  });

  // Combine all episode data into a single map for easy lookup
  const episodeTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    scheduleEpisodesQueries.forEach((query, index) => {
      if (query.data) {
        const show = scheduleShows[index];
        query.data.forEach(ep => {
          const key = `${show.content_id}-${ep.season}-${ep.episode_number}`;
          map.set(key, ep.title);
        });
      }
    });
    return map;
  }, [scheduleEpisodesQueries, scheduleShows]);

  // Group episodes by season
  const episodesBySeason = useMemo(() => {
    if (!episodes) return {};
    return episodes.reduce((acc, ep) => {
      if (!acc[ep.season]) acc[ep.season] = [];
      acc[ep.season].push(ep);
      return acc;
    }, {} as Record<number, Episode[]>);
  }, [episodes]);

  // Schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: (params: {
      content_id: string;
      season?: number;
      episode?: number;
      scheduled_time: string;
      duration?: number;
    }) => createScheduleItem(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      toast.success('Item scheduled successfully');
    },
    onError: () => {
      toast.error('Failed to schedule item');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteScheduleItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      toast.success('Item removed from schedule');
    },
    onError: () => {
      toast.error('Failed to remove item');
    },
  });

  // Batch schedule mutation
  const batchScheduleMutation = useMutation({
    mutationFn: async (items: PendingScheduleItem[]) => {
      const promises = items.map(item =>
        createScheduleItem({
          content_id: item.content_id,
          season: item.season ?? undefined,
          episode: item.episode ?? undefined,
          scheduled_time: item.scheduled_time,
          duration: item.duration,
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      setPendingItems(new Map());
      toast.success('All items scheduled successfully');
    },
    onError: () => {
      toast.error('Failed to schedule some items');
    },
  });

  // Get all scheduled items for the selected date
  const getAllScheduledItems = (): { saved: ScheduleItem[]; pending: PendingScheduleItem[] } => {
    if (!selectedDate) return { saved: [], pending: [] };

    const dateObj = toDate(selectedDate);
    if (!dateObj) return { saved: [], pending: [] };

    // Use local date methods to compare dates correctly (avoid timezone issues)
    const selectedYear = dateObj.getFullYear();
    const selectedMonth = dateObj.getMonth();
    const selectedDay = dateObj.getDate();

    const saved = schedule?.filter((item) => {
      const itemDate = new Date(item.scheduled_time);
      // Compare using local date methods to avoid timezone conversion issues
      return (
        itemDate.getFullYear() === selectedYear &&
        itemDate.getMonth() === selectedMonth &&
        itemDate.getDate() === selectedDay
      );
    }) || [];

    const pending = Array.from(pendingItems.values()).filter((item) => {
      const itemDate = new Date(item.scheduled_time);
      return (
        itemDate.getFullYear() === selectedYear &&
        itemDate.getMonth() === selectedMonth &&
        itemDate.getDate() === selectedDay
      );
    });

    return { saved, pending };
  };

  // Handle timeline mouse move
  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!queue || queue.length === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const paddingTop = 12;
    const clickY = e.clientY - rect.top - paddingTop;
    const timeInfo = getTimeFromPosition(clickY, rect.height - paddingTop, selectedDate);
    
    if (timeInfo) {
      if (isTimeRangeOccupied(timeInfo.time, 15, schedule, pendingItems)) {
        setHoveredTime(null);
        return;
      }
      
      const availableDuration = getAvailableDuration(timeInfo.time, schedule, pendingItems);
      setHoveredTime({ 
        time: timeInfo.time, 
        hour: timeInfo.hour,
        minute: timeInfo.minute,
        availableDuration,
        mouseX: e.clientX,
        mouseY: e.clientY,
      });
    } else {
      setHoveredTime(null);
    }
  };

  // Handle timeline mouse leave
  const handleTimelineMouseLeave = () => {
    setHoveredTime(null);
  };

  // Handle timeline click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!queue || queue.length === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const paddingTop = 12;
    const clickY = e.clientY - rect.top - paddingTop;
    const timeInfo = getTimeFromPosition(clickY, rect.height - paddingTop, selectedDate);
    
    if (!timeInfo) return;
    
    if (isTimeRangeOccupied(timeInfo.time, 15, schedule, pendingItems)) {
      toast.error(getOccupiedErrorMessage(timeInfo.time, 15, schedule, pendingItems));
      return;
    }
    
    const clickedSlot: TimeSlot = {
      hour: timeInfo.hour,
      minute: timeInfo.minute,
      display: timeInfo.time.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    };
    
    setSelectedTimeSlot(clickedSlot);
    setScheduleModalOpened(true);
  };

  // Handle episode toggle
  const handleEpisodeToggle = (season: number, episode: number, checked: boolean) => {
    setSelectedEpisodes(prev => {
      const next = new Map(prev);
      const key = `${season}-${episode}`;
      if (checked) {
        next.set(key, { season, episode });
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  // Check if episode is selected
  const isEpisodeSelected = (season: number, episodeNumber: number): boolean => {
    return selectedEpisodes.has(`${season}-${episodeNumber}`);
  };

  // Helper to sort episodes sequentially
  const sortEpisodesSequentially = (
    selectedEpisodes: Map<string, { season: number; episode: number }>,
    episodes: Episode[] | undefined
  ): Array<{ season: number; episode: number; episodeData?: Episode }> => {
    return Array.from(selectedEpisodes.values())
      .map(ep => ({
        season: ep.season,
        episode: ep.episode,
        episodeData: episodes?.find(e => e.season === ep.season && e.episode_number === ep.episode),
      }))
      .sort((a, b) => {
        if (a.season !== b.season) return a.season - b.season;
        return a.episode - b.episode;
      });
  };

  // Helper to shuffle episodes randomly
  const shuffleEpisodesRandomly = (
    selectedEpisodes: Map<string, { season: number; episode: number }>,
    episodes: Episode[] | undefined
  ): Array<{ season: number; episode: number; episodeData?: Episode }> => {
    const sorted = sortEpisodesSequentially(selectedEpisodes, episodes);
    // Fisher-Yates shuffle
    const shuffled = [...sorted];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Find next available time slot
  const findNextAvailableTime = (
    startTime: Date,
    duration: number,
    schedule: ScheduleItem[] | undefined,
    pendingItems: Map<string, PendingScheduleItem>
  ): Date | null => {
    let currentTime = new Date(startTime);
    const endOfDay = new Date(currentTime);
    endOfDay.setHours(23, 59, 59, 999);

    // Try every 15 minutes until we find an available slot or reach end of day
    while (currentTime <= endOfDay) {
      if (!isTimeRangeOccupied(currentTime, duration, schedule, pendingItems)) {
        return currentTime;
      }
      // Move forward by 15 minutes
      currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
    }
    return null;
  };

  // Add to pending - updated to handle both sequential and random modes
  const addToPending = (queueItem: QueueItem) => {
    if (!selectedDate || !selectedTimeSlot) return;

    const dateObj = toDate(selectedDate);
    if (!dateObj) return;

    if (queueItem.content_type === 'show') {
      if (selectedEpisodes.size === 0) {
        toast.error('Please select at least one episode');
        return;
      }

      // Get episodes based on mode
      const episodesToSchedule = schedulingMode === 'sequential'
        ? sortEpisodesSequentially(selectedEpisodes, episodes)
        : shuffleEpisodesRandomly(selectedEpisodes, episodes);

      let currentTime = new Date(dateObj);
      currentTime.setHours(selectedTimeSlot.hour, selectedTimeSlot.minute, 0, 0);

      const newPendingItems = new Map(pendingItems);
      const scheduled: Array<{ season: number; episode: number; title: string }> = [];
      const failed: Array<{ season: number; episode: number; title: string; reason: string }> = [];

      for (const ep of episodesToSchedule) {
        const duration = ep.episodeData?.duration || 30;
        
        // For sequential: use current time, for random: find next available
        const scheduleTime = schedulingMode === 'sequential'
          ? currentTime
          : findNextAvailableTime(currentTime, duration, schedule, newPendingItems);

        if (!scheduleTime) {
          failed.push({
            season: ep.season,
            episode: ep.episode,
            title: ep.episodeData?.title || `S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`,
            reason: 'No available time slots remaining',
          });
          break;
        }

        if (isTimeRangeOccupied(scheduleTime, duration, schedule, newPendingItems)) {
          const errorMsg = getOccupiedErrorMessage(scheduleTime, duration, schedule, newPendingItems);
          failed.push({
            season: ep.season,
            episode: ep.episode,
            title: ep.episodeData?.title || `S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`,
            reason: errorMsg,
          });
          // For sequential, stop on conflict. For random, try next episode
          if (schedulingMode === 'sequential') break;
          continue;
        }

        // Add to pending
        const pendingId = `${queueItem.content_id}-${ep.season}-${ep.episode}-${scheduleTime.toISOString()}`;
        newPendingItems.set(pendingId, {
          id: pendingId,
          content_id: queueItem.content_id,
          season: ep.season,
          episode: ep.episode,
          scheduled_time: scheduleTime.toISOString(),
          title: `${queueItem.title} - S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`,
          duration: ep.episodeData?.duration,
        });

        scheduled.push({
          season: ep.season,
          episode: ep.episode,
          title: ep.episodeData?.title || `S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`,
        });

        // Update current time based on mode
        if (schedulingMode === 'sequential') {
          currentTime = new Date(scheduleTime.getTime() + duration * 60 * 1000);
        } else {
          currentTime = new Date(scheduleTime.getTime() + duration * 60 * 1000);
        }
      }

      setPendingItems(newPendingItems);

      // Report results
      if (scheduled.length > 0 && failed.length === 0) {
        toast.success(`All ${scheduled.length} episode(s) added to pending`);
      } else if (scheduled.length > 0 && failed.length > 0) {
        const failedList = failed.map(f => `${f.title}`).join(', ');
        toast.warning(
          `${scheduled.length} episode(s) added to pending. ${failed.length} episode(s) couldn't be scheduled: ${failedList}`,
          { duration: 5000 }
        );
      } else {
        toast.error(`Could not schedule any episodes: ${failed[0]?.reason || 'Unknown error'}`);
      }

      setSelectedEpisodes(new Map());
    } else {
      const scheduledTime = new Date(dateObj);
      scheduledTime.setHours(selectedTimeSlot.hour, selectedTimeSlot.minute, 0, 0);
      const duration = 120;
      
      if (isTimeRangeOccupied(scheduledTime, duration, schedule, pendingItems)) {
        toast.error(getOccupiedErrorMessage(scheduledTime, duration, schedule, pendingItems));
        return;
      }

      const pendingId = `${queueItem.content_id}-${scheduledTime.toISOString()}`;
      const newPendingItems = new Map(pendingItems);
      newPendingItems.set(pendingId, {
        id: pendingId,
        content_id: queueItem.content_id,
        season: null,
        episode: null,
        scheduled_time: scheduledTime.toISOString(),
        title: queueItem.title || 'Unknown',
        duration: undefined,
      });

      setPendingItems(newPendingItems);
      toast.success('Added to pending');
    }
  };

  // Handle schedule item (immediate save) - updated to handle both sequential and random modes
  const handleScheduleItem = async (queueItem: QueueItem) => {
    if (!selectedDate || !selectedTimeSlot) return;

    const dateObj = toDate(selectedDate);
    if (!dateObj) return;

    if (queueItem.content_type === 'show') {
      if (selectedEpisodes.size === 0) {
        toast.error('Please select at least one episode');
        return;
      }

      // Get episodes based on mode
      const episodesToSchedule = schedulingMode === 'sequential'
        ? sortEpisodesSequentially(selectedEpisodes, episodes)
        : shuffleEpisodesRandomly(selectedEpisodes, episodes);

      let currentTime = new Date(dateObj);
      currentTime.setHours(selectedTimeSlot.hour, selectedTimeSlot.minute, 0, 0);

      const scheduled: Array<{ season: number; episode: number; title: string }> = [];
      const failed: Array<{ season: number; episode: number; title: string; reason: string }> = [];

      for (const ep of episodesToSchedule) {
        const duration = ep.episodeData?.duration || 30;
        
        // For sequential: use current time, for random: find next available
        const scheduleTime = schedulingMode === 'sequential'
          ? currentTime
          : findNextAvailableTime(currentTime, duration, schedule, pendingItems);

        if (!scheduleTime) {
          failed.push({
            season: ep.season,
            episode: ep.episode,
            title: ep.episodeData?.title || `S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`,
            reason: 'No available time slots remaining',
          });
          break;
        }

        if (isTimeRangeOccupied(scheduleTime, duration, schedule, pendingItems)) {
          const errorMsg = getOccupiedErrorMessage(scheduleTime, duration, schedule, pendingItems);
          failed.push({
            season: ep.season,
            episode: ep.episode,
            title: ep.episodeData?.title || `S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`,
            reason: errorMsg,
          });
          // For sequential, stop on conflict. For random, try next episode
          if (schedulingMode === 'sequential') break;
          continue;
        }

        try {
          // Schedule immediately
          await scheduleMutation.mutateAsync({
            content_id: queueItem.content_id,
            season: ep.season,
            episode: ep.episode,
            scheduled_time: scheduleTime.toISOString(),
            duration: ep.episodeData?.duration,
          });

          scheduled.push({
            season: ep.season,
            episode: ep.episode,
            title: ep.episodeData?.title || `S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`,
          });

          // Update current time based on mode
          if (schedulingMode === 'sequential') {
            currentTime = new Date(scheduleTime.getTime() + duration * 60 * 1000);
          } else {
            currentTime = new Date(scheduleTime.getTime() + duration * 60 * 1000);
          }
        } catch {
          failed.push({
            season: ep.season,
            episode: ep.episode,
            title: ep.episodeData?.title || `S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`,
            reason: 'Failed to save',
          });
          break;
        }
      }

      // Report results
      if (scheduled.length > 0 && failed.length === 0) {
        toast.success(`All ${scheduled.length} episode(s) scheduled successfully`);
      } else if (scheduled.length > 0 && failed.length > 0) {
        const failedList = failed.map(f => `${f.title}`).join(', ');
        toast.warning(
          `${scheduled.length} episode(s) scheduled. ${failed.length} episode(s) couldn't be scheduled: ${failedList}`,
          { duration: 5000 }
        );
      } else {
        toast.error(`Could not schedule any episodes: ${failed[0]?.reason || 'Unknown error'}`);
      }

      setScheduleModalOpened(false);
      setSelectedQueueItem(null);
      setSelectedTimeSlot(null);
      setSelectedEpisodes(new Map());
    } else {
      const scheduledTime = new Date(dateObj);
      scheduledTime.setHours(selectedTimeSlot.hour, selectedTimeSlot.minute, 0, 0);
      const duration = 120;
      
      if (isTimeRangeOccupied(scheduledTime, duration, schedule, pendingItems)) {
        toast.error(getOccupiedErrorMessage(scheduledTime, duration, schedule, pendingItems));
        return;
      }
      
      scheduleMutation.mutate({
        content_id: queueItem.content_id,
        scheduled_time: scheduledTime.toISOString(),
        duration,
      });

      toast.success('Item scheduled');
      setScheduleModalOpened(false);
      setSelectedQueueItem(null);
      setSelectedTimeSlot(null);
    }
  };

  // Handle save all pending items
  const handleSaveAll = () => {
    if (pendingItems.size === 0) {
      toast.error('No pending items to save');
      return;
    }
    batchScheduleMutation.mutate(Array.from(pendingItems.values()));
  };

  // Remove pending item
  const handleRemovePending = (id: string) => {
    setPendingItems(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  // Reset modal selection
  const resetModalSelection = () => {
    setScheduleModalOpened(false);
    setSelectedQueueItem(null);
    setSelectedTimeSlot(null);
    setSelectedEpisodes(new Map());
  };

  return {
    // State
    selectedDate,
    setSelectedDate,
    selectedTimeSlot,
    scheduleModalOpened,
    setScheduleModalOpened,
    selectedQueueItem,
    setSelectedQueueItem,
    selectedEpisodes,
    pendingItems,
    hoveredTime,
    schedulingMode,
    setSchedulingMode,
    
    // Data
    schedule,
    queue,
    episodes,
    episodesBySeason,
    episodeTitleMap,
    
    // Loading states
    scheduleLoading,
    queueLoading,
    episodesLoading,
    isScheduling: scheduleMutation.isPending,
    isBatchSaving: batchScheduleMutation.isPending,
    
    // Computed
    getAllScheduledItems,
    isEmpty: !queue || queue.length === 0,
    
    // Handlers
    handleTimelineClick,
    handleTimelineMouseMove,
    handleTimelineMouseLeave,
    handleEpisodeToggle,
    isEpisodeSelected,
    addToPending,
    handleScheduleItem,
    handleSaveAll,
    handleRemovePending,
    resetModalSelection,
    onDeleteItem: (id: string, type: 'saved' | 'pending') => {
      if (type === 'saved') {
        deleteMutation.mutate(id);
      } else {
        handleRemovePending(id);
      }
    },
    onQueueItemClick: (item: QueueItem) => {
      setSelectedQueueItem(item);
      setScheduleModalOpened(true);
    },
    onModalClose: resetModalSelection,
  };
}

