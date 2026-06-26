import { useMemo, useState } from 'react';
import { Modal, SegmentedControl, Checkbox, Button, Collapse, ScrollArea } from '@mantine/core';
import { ChevronRight } from 'lucide-react';
import type { PoolItem } from './mockSchedule';

const ACCENT = '#646cff';
type Mode = 'all' | 'include' | 'exclude';

/**
 * Mock per-show episode picker — maps 1:1 to the backend `episode_filters`
 * EpisodeFilterRule { mode: 'all'|'include'|'exclude', seasons, episodes }.
 * Lets you keep "all", or pick seasons / individual episodes to include or skip.
 */
export function EpisodePicker({
  item,
  opened,
  onClose,
}: {
  item: PoolItem;
  opened: boolean;
  onClose: () => void;
}) {
  const seasons = item.seasons ?? 1;
  const perSeason = item.epsPerSeason ?? 12;
  const [mode, setMode] = useState<Mode>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openSeason, setOpenSeason] = useState<number | null>(1);

  const key = (s: number, e: number) => `${s}-${e}`;

  const toggleEp = (s: number, e: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const k = key(s, e);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const seasonState = (s: number) => {
    const eps = Array.from({ length: perSeason }, (_, i) => i + 1);
    const on = eps.filter((e) => selected.has(key(s, e))).length;
    return { all: on === eps.length, some: on > 0 && on < eps.length, count: on };
  };

  const toggleSeason = (s: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const { all } = seasonState(s);
      for (let e = 1; e <= perSeason; e++) {
        const k = key(s, e);
        if (all) next.delete(k);
        else next.add(k);
      }
      return next;
    });

  const summary = useMemo(() => {
    if (mode === 'all') return 'All episodes, in order';
    const verb = mode === 'include' ? 'Only' : 'Skipping';
    return selected.size === 0 ? `${verb} — nothing chosen yet` : `${verb} ${selected.size} episode${selected.size === 1 ? '' : 's'}`;
  }, [mode, selected]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<span className="font-bold">Episodes · {item.title}</span>}
      size="md"
      radius="md"
    >
      <SegmentedControl
        fullWidth
        value={mode}
        onChange={(v) => setMode(v as Mode)}
        data={[
          { label: 'All', value: 'all' },
          { label: 'Only these', value: 'include' },
          { label: 'Skip these', value: 'exclude' },
        ]}
        className="mb-3"
      />

      <p className="text-xs text-[rgb(var(--color-text-secondary))] mb-3">{summary}</p>

      {mode !== 'all' && (
        <ScrollArea.Autosize mah={340} className="border border-[rgb(var(--color-border-default))] rounded-lg">
          {Array.from({ length: seasons }, (_, i) => i + 1).map((s) => {
            const st = seasonState(s);
            const isOpen = openSeason === s;
            return (
              <div key={s} className="border-b border-[rgb(var(--color-border-subtle))] last:border-b-0">
                <div className="flex items-center gap-2 px-3 py-2">
                  <Checkbox
                    size="sm"
                    checked={st.all}
                    indeterminate={st.some}
                    onChange={() => toggleSeason(s)}
                    color="indigo"
                  />
                  <button
                    onClick={() => setOpenSeason(isOpen ? null : s)}
                    className="flex-1 flex items-center justify-between text-left"
                  >
                    <span className="text-sm font-semibold">Season {s}</span>
                    <span className="flex items-center gap-2 text-xs text-[rgb(var(--color-text-tertiary))]">
                      {st.count > 0 && `${st.count}/${perSeason}`}
                      <ChevronRight
                        size={15}
                        style={{ transform: isOpen ? 'rotate(90deg)' : undefined, transition: '150ms' }}
                      />
                    </span>
                  </button>
                </div>
                <Collapse in={isOpen}>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-3 gap-y-1.5 px-3 pb-3 pl-9">
                    {Array.from({ length: perSeason }, (_, i) => i + 1).map((e) => (
                      <Checkbox
                        key={e}
                        size="xs"
                        color="indigo"
                        checked={selected.has(key(s, e))}
                        onChange={() => toggleEp(s, e)}
                        label={`E${e}`}
                        classNames={{ label: 'text-xs' }}
                      />
                    ))}
                  </div>
                </Collapse>
              </div>
            );
          })}
        </ScrollArea.Autosize>
      )}

      <div className="flex justify-end mt-4">
        <Button onClick={onClose} styles={{ root: { backgroundColor: ACCENT } }} className="font-semibold">
          Done
        </Button>
      </div>
    </Modal>
  );
}
