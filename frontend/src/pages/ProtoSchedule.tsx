import { useState } from 'react';
import { Container, Button, Collapse, Select, TextInput } from '@mantine/core';
import {
  CalendarPlus,
  SlidersHorizontal,
  ChevronDown,
  Repeat,
  Layers,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ScheduleXProto } from '../proto/ScheduleXProto';
import { RealLineupDrawer } from '../proto/RealLineupDrawer';
import type { EpisodeFilter } from '../proto/LineupEpisodePicker';
import { getSchedule, deleteScheduleItem, generateScheduleFromQueue, clearScheduleForDate } from '../api/schedule';
import { getTimeOfDayLabel } from '../utils/format';
import type { GenerateScheduleRequest } from '../types/api';

const pad = (n: number) => String(n).padStart(2, '0');
const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
// Browser timezone as "-05:00" / "+00:00" (matches the backend's expected format).
const tzOffset = () => {
  const off = new Date().getTimezoneOffset();
  const sign = off <= 0 ? '+' : '-';
  return `${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
};
// "2026-06-26" -> "Friday, June 26, 2026". Parsed as local so there's no TZ off-by-one.
const formatLongDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};
const addDays = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};
// Monday of the calendar week containing `ymd` (matches Schedule-X's default
// firstDayOfWeek = Monday, so the fetched range lines up with the week grid).
const startOfWeek = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=Sun..6=Sat
  return addDays(ymd, -((dow + 6) % 7)); // days back to Monday
};

const ACCENT = '#646cff';

const START_PRESETS = [
  { value: 'morning', label: 'Morning (9:00 AM)', hour: 9 },
  { value: 'afternoon', label: 'Afternoon (3:00 PM)', hour: 15 },
  { value: 'evening', label: 'Evening (6:00 PM)', hour: 18 },
  { value: 'prime', label: 'Prime time (8:00 PM)', hour: 20 },
  { value: 'late', label: 'Late night (11:00 PM)', hour: 23 },
];
const DURATIONS = [
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1½ hours' },
  { value: '120', label: '2 hours' },
  { value: '180', label: '3 hours' },
];
const DATE_RANGES = [
  { value: 'tonight', label: 'Just this day' },
  { value: 'next3', label: 'Next 3 days' },
  { value: 'week', label: 'This week' },
];
const ROTATIONS = [
  { value: 'turns', icon: <Repeat size={16} />, title: 'Take turns', desc: 'One episode from each show, then loop back around.' },
  { value: 'two', icon: <Layers size={16} />, title: 'Two at a time', desc: 'Two episodes from a show before moving to the next.' },
  { value: 'shuffle', icon: <Shuffle size={16} />, title: 'Shuffle', desc: 'Random picks from across your whole lineup.' },
];

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const fmt12 = (totalMin: number) => {
  const h24 = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${pad(m)} ${h24 < 12 ? 'AM' : 'PM'}`;
};
const TIME_OPTS = Array.from({ length: 48 }, (_, i) => ({
  value: `${pad(Math.floor((i * 30) / 60))}:${pad((i * 30) % 60)}`,
  label: fmt12(i * 30),
}));

/**
 * Scheduling workspace — concierge / single-timeline model on real data.
 * Build a lineup, auto-generate a day, view/remove/clear on the timeline.
 * Promoted from the /proto/schedule prototype; gated behind the scheduleV2 flag.
 */
export function ProtoSchedule() {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [timeMode, setTimeMode] = useState<'preset' | 'custom'>('preset');
  const [startPreset, setStartPreset] = useState('prime');
  const [durationMin, setDurationMin] = useState('180');
  const [customStart, setCustomStart] = useState('18:00');
  const [customEnd, setCustomEnd] = useState('23:00');
  const [rotation, setRotation] = useState('turns');
  const [dateRange, setDateRange] = useState('tonight');
  const [date, setDate] = useState(todayStr());
  // Per-show season/episode selection (session-scoped) -> generator episode_filters.
  const [episodeFilters, setEpisodeFilters] = useState<Record<string, EpisodeFilter>>({});

  const onFilterChange = (contentId: string, filter: EpisodeFilter | undefined) => {
    setEpisodeFilters((prev) => {
      const next = { ...prev };
      if (!filter) delete next[contentId];
      else next[contentId] = filter;
      return next;
    });
  };

  // Days the timeline covers. "This week" aligns to the calendar week (Sun-Sat);
  // "Next 3 days" rolls forward from the picked date.
  const rangeDays = dateRange === 'next3' ? 3 : dateRange === 'week' ? 7 : 1;
  const view = rangeDays > 1 ? 'week' : 'day';
  const rangeStart = dateRange === 'week' ? startOfWeek(date) : date;
  const dates = Array.from({ length: rangeDays }, (_, i) => addDays(rangeStart, i));

  const dayQueries = useQueries({
    queries: dates.map((d) => ({
      queryKey: ['schedule', d],
      queryFn: () => getSchedule(d),
      staleTime: 30000,
    })),
  });
  const items = dayQueries.flatMap((qr) => qr.data ?? []);
  const isLoading = dayQueries.some((qr) => qr.isLoading);
  const isError = dayQueries.some((qr) => qr.isError);

  const queryClient = useQueryClient();
  // Generate/clear can touch several days, so refresh the whole schedule cache.
  const invalidateDay = () => queryClient.invalidateQueries({ queryKey: ['schedule'] });

  // Remove a placed item: persist, then refetch so the timeline reflects it.
  const deleteMutation = useMutation({
    mutationFn: deleteScheduleItem,
    onSuccess: invalidateDay,
    onError: () => toast.error('Could not remove that item'),
  });

  // Fill the timeline from the user's backend queue for the active date(s).
  const generateMutation = useMutation({
    mutationFn: (params: GenerateScheduleRequest) => generateScheduleFromQueue(params),
    onSuccess: (res) => {
      invalidateDay();
      const scheduled = res.metadata?.scheduled ?? res.schedule?.length ?? 0;
      toast.success(`Scheduled ${scheduled} item${scheduled === 1 ? '' : 's'}`);
      if (res.metadata?.skipped) toast.message(`${res.metadata.skipped} skipped (conflicts)`);
    },
    onError: () => toast.error('Could not generate a schedule'),
  });

  // Wipe every day the timeline covers so generate can run fresh (generate appends).
  const clearMutation = useMutation({
    mutationFn: () => Promise.all(dates.map((d) => clearScheduleForDate(d))),
    onSuccess: () => {
      invalidateDay();
      toast.success(rangeDays > 1 ? 'Cleared range' : 'Cleared');
    },
    onError: () => toast.error('Could not clear'),
  });

  // Resolve the chosen controls into a start/end window (minutes-of-day for preview).
  const presetStartMin = (START_PRESETS.find((p) => p.value === startPreset)?.hour ?? 20) * 60;
  const startMin = timeMode === 'custom' ? toMin(customStart) : presetStartMin;
  const endMin = timeMode === 'custom' ? toMin(customEnd) : presetStartMin + Number(durationMin);

  const handleGenerate = () => {
    generateMutation.mutate({
      start_date: rangeStart,
      end_date: addDays(rangeStart, rangeDays - 1),
      start_time: `${pad(Math.floor(startMin / 60) % 24)}:${pad(startMin % 60)}`,
      // Backend handles end < start as a midnight crossover.
      end_time: `${pad(Math.floor(endMin / 60) % 24)}:${pad(endMin % 60)}`,
      timezone_offset: tzOffset(),
      rotation_type:
        rotation === 'shuffle' ? 'random' : rotation === 'two' ? 'round_robin_double' : 'round_robin',
      include_reruns: false,
      episode_filters: Object.keys(episodeFilters).length ? episodeFilters : undefined,
    });
  };

  const isToday = date === todayStr();
  const itemCount = items.length;
  const rangeLabel = DATE_RANGES.find((r) => r.value === dateRange)?.label ?? '';

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg-page))]">
      <Container size="lg" className="py-8 px-4 sm:px-6">
        <div className="flex items-end justify-between gap-3 mb-6 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-tertiary))] mb-1">
              Scheduling for
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              {isToday ? `${getTimeOfDayLabel()} · ` : ''}
              {formatLongDate(date)}
            </h1>
          </div>
          {/* One date control for the whole page: which day + how many days. Both drive
              the heading, the fetched range, and the calendar together. */}
          <div className="flex items-end gap-2">
            <TextInput
              size="sm"
              type="date"
              label="Date"
              value={date}
              // Ignore empty values: spinning a native date input past a month's last
              // day (e.g. Jun 30 -> 31) briefly emits "", which would crash the calendar
              // ("can't parse empty string as date-time"). Keep the previous date instead.
              onChange={(e) => { const v = e.currentTarget.value; if (v) setDate(v); }}
              aria-label="Schedule date"
            />
            <Select
              size="sm"
              label="Show"
              data={DATE_RANGES}
              value={dateRange}
              onChange={(v) => setDateRange(v || 'tonight')}
              allowDeselect={false}
              aria-label="How many days to schedule"
              className="w-36"
            />
          </div>
        </div>

        {/* ===== Concierge hero: one-tap auto-schedule + progressive disclosure ===== */}
        <section className="rounded-xl border border-[rgb(var(--color-border-default))] bg-[rgb(var(--color-bg-surface))] p-5 sm:p-6 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight">Auto-schedule my lineup</h2>
              <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">
                Fills <span className="font-semibold">{fmt12(startMin)} – {fmt12(endMin)}</span>
                {' · '}
                {ROTATIONS.find((r) => r.value === rotation)?.title.toLowerCase()}
                {dateRange !== 'tonight' ? ` · ${rangeLabel.toLowerCase()}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="md"
                leftSection={<CalendarPlus size={18} />}
                onClick={handleGenerate}
                loading={generateMutation.isPending}
                styles={{ root: { backgroundColor: ACCENT } }}
                className="font-semibold"
              >
                Schedule it
              </Button>
              <Button
                size="md"
                variant="default"
                leftSection={<SlidersHorizontal size={16} />}
                rightSection={
                  <ChevronDown
                    size={15}
                    style={{ transform: customizeOpen ? 'rotate(180deg)' : undefined, transition: '150ms' }}
                  />
                }
                onClick={() => setCustomizeOpen((o) => !o)}
                className="font-semibold"
              >
                Customize
              </Button>
            </div>
          </div>

          {/* Customize (progressive disclosure) */}
          <Collapse in={customizeOpen}>
            <div className="mt-5 pt-5 border-t border-[rgb(var(--color-border-subtle))] space-y-5">
              {/* Time: preset block (start + duration) or a custom range */}
              <Field label="Time">
                <div className="flex items-center gap-2 mb-3">
                  <Chip active={timeMode === 'preset'} onClick={() => setTimeMode('preset')}>
                    Preset block
                  </Chip>
                  <Chip active={timeMode === 'custom'} onClick={() => setTimeMode('custom')}>
                    Custom range
                  </Chip>
                </div>

                {timeMode === 'preset' ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-[rgb(var(--color-text-tertiary))] mb-1">Start at</p>
                        <Select
                          size="sm"
                          data={START_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
                          value={startPreset}
                          onChange={(v) => setStartPreset(v || 'prime')}
                          allowDeselect={false}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-[rgb(var(--color-text-tertiary))] mb-1">How long?</p>
                        <Select
                          size="sm"
                          data={DURATIONS}
                          value={durationMin}
                          onChange={(v) => setDurationMin(v || '180')}
                          allowDeselect={false}
                        />
                      </div>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-2 text-sm rounded-lg bg-[rgb(var(--color-bg-elevated))] px-3 py-1.5">
                      <span className="font-semibold">{fmt12(startMin)}</span>
                      <span className="text-[rgb(var(--color-text-tertiary))]">→</span>
                      <span className="font-semibold">{fmt12(endMin)}</span>
                      <span className="text-[rgb(var(--color-text-tertiary))]">· {durationMin} min</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 max-w-md">
                    <Select
                      size="sm"
                      data={TIME_OPTS}
                      value={customStart}
                      onChange={(v) => setCustomStart(v || '18:00')}
                      allowDeselect={false}
                      searchable
                      className="flex-1"
                    />
                    <span className="text-[rgb(var(--color-text-tertiary))]">to</span>
                    <Select
                      size="sm"
                      data={TIME_OPTS}
                      value={customEnd}
                      onChange={(v) => setCustomEnd(v || '23:00')}
                      allowDeselect={false}
                      searchable
                      className="flex-1"
                    />
                  </div>
                )}
              </Field>

              {/* Rotation — plain names + a one-line explanation each */}
              <Field label="How your night flows">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {ROTATIONS.map((r) => (
                    <RotationCard
                      key={r.value}
                      active={rotation === r.value}
                      onClick={() => setRotation(r.value)}
                      icon={r.icon}
                      title={r.title}
                      desc={r.desc}
                    />
                  ))}
                </div>
              </Field>
            </div>
          </Collapse>
        </section>

        {/* ===== The timeline ===== */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-tertiary))]">
              Schedule
            </h3>
            {itemCount > 0 && (
              <button
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[rgb(var(--color-text-tertiary))] hover:text-red-500 transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} /> {rangeDays > 1 ? 'Clear range' : 'Clear day'}
              </button>
            )}
          </div>

          <p className="text-xs text-[rgb(var(--color-text-tertiary))] mb-2">
            {isLoading
              ? 'Loading schedule…'
              : isError
                ? 'Could not load schedule (are you signed in?).'
                : `${itemCount} scheduled item${itemCount === 1 ? '' : 's'} ${view === 'week' ? `across ${rangeDays} days from ${rangeStart}` : `on ${date}`}.`}
          </p>

          {/* key excludes itemCount on purpose: adding/removing an item updates events
              in place (see ScheduleXProto) instead of remounting the whole calendar. */}
          <ScheduleXProto
            key={`${view}-${date}`}
            items={items}
            selectedDate={date}
            view={view}
            windowStart={`${pad(Math.floor(startMin / 60) % 24)}:${pad(startMin % 60)}`}
            onRemove={(id) => deleteMutation.mutate(id)}
          />
        </section>

        {/* ===== The lineup / content drawer ===== */}
        <RealLineupDrawer episodeFilters={episodeFilters} onFilterChange={onFilterChange} />
      </Container>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
        active
          ? 'bg-[#646cff] text-white border-[#646cff]'
          : 'border-[rgb(var(--color-border-default))] text-[rgb(var(--color-text-secondary))] hover:border-[#646cff]'
      }`}
    >
      {children}
    </button>
  );
}

function RotationCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-lg border transition-colors ${
        active
          ? 'border-[#646cff] bg-[#646cff]/5'
          : 'border-[rgb(var(--color-border-default))] hover:border-[rgb(var(--color-text-tertiary))]'
      }`}
    >
      <span className="flex items-center gap-2 font-semibold text-sm">
        <span className={active ? 'text-[#646cff]' : 'text-[rgb(var(--color-text-secondary))]'}>{icon}</span>
        {title}
      </span>
      <span className="block text-xs text-[rgb(var(--color-text-secondary))] mt-1 leading-snug">{desc}</span>
    </button>
  );
}
