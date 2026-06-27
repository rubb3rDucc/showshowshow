import { useEffect, useState } from 'react';
import { Modal, Checkbox, Button } from '@mantine/core';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getEpisodesByContentId } from '../api/content';
import type { Episode } from '../types/api';

// Matches the generator's episode_filters rule.
export type EpisodeFilter = {
  mode: 'include' | 'exclude';
  seasons?: number[];
  episodes?: { season: number; episode: number }[];
};

const key = (s: number, e: number) => `${s}-${e}`;

// Is this episode included under the given filter? (undefined filter = everything.)
function isIncluded(ep: Episode, filter: EpisodeFilter | undefined): boolean {
  if (!filter) return true;
  const matches =
    (filter.seasons?.includes(ep.season) ?? false) ||
    (filter.episodes?.some((x) => x.season === ep.season && x.episode === ep.episode_number) ?? false);
  return filter.mode === 'exclude' ? !matches : matches;
}

/**
 * Episode-level picker for a lineup show. Fetches the show's episodes, lets the user
 * include/exclude whole seasons or specific episodes, and emits an episode_filters
 * rule (fully-checked seasons -> seasons[], partial seasons -> episodes[]).
 * Everything checked -> undefined (no filter). Session-scoped.
 */
export function LineupEpisodePicker({
  opened,
  onClose,
  contentId,
  title,
  value,
  onChange,
}: {
  opened: boolean;
  onClose: () => void;
  contentId: string;
  title: string;
  value: EpisodeFilter | undefined;
  onChange: (filter: EpisodeFilter | undefined) => void;
}) {
  const episodesQ = useQuery({
    queryKey: ['episodes', contentId],
    queryFn: () => getEpisodesByContentId(contentId),
    enabled: opened,
    staleTime: 300000,
  });
  const episodes = episodesQ.data ?? [];

  // Episodes grouped by season, both sorted ascending.
  const seasons = [...new Set(episodes.map((e) => e.season))].sort((a, b) => a - b);
  const bySeason = new Map<number, Episode[]>(
    seasons.map((s) => [s, episodes.filter((e) => e.season === s).sort((a, b) => a.episode_number - b.episode_number)])
  );

  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Seed the selection from `value` once episodes load for this opening.
  useEffect(() => {
    if (!opened || episodes.length === 0) {
      if (!opened) setSelected(null);
      return;
    }
    const seed = new Set<string>();
    for (const ep of episodes) if (isIncluded(ep, value)) seed.add(key(ep.season, ep.episode_number));
    setSelected(seed);
    // Re-seed only on open / when the episode set first loads — not on every `value` change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, episodes.length, contentId]);

  // Recompute the filter rule from a selection and bubble it up.
  const emit = (next: Set<string>) => {
    setSelected(next);
    if (next.size === episodes.length) {
      onChange(undefined); // everything selected → no filter
      return;
    }
    if (next.size === 0) {
      // Nothing selected → exclude the whole show (an empty include is read as "all").
      onChange({ mode: 'exclude', seasons });
      return;
    }
    const fullSeasons: number[] = [];
    const partialEpisodes: { season: number; episode: number }[] = [];
    for (const [season, list] of bySeason) {
      const chosen = list.filter((ep) => next.has(key(ep.season, ep.episode_number)));
      if (chosen.length === list.length) fullSeasons.push(season);
      else chosen.forEach((ep) => partialEpisodes.push({ season, episode: ep.episode_number }));
    }
    onChange({
      mode: 'include',
      seasons: fullSeasons.length ? fullSeasons : undefined,
      episodes: partialEpisodes.length ? partialEpisodes : undefined,
    });
  };

  const toggleEp = (s: number, e: number) => {
    if (!selected) return;
    const next = new Set(selected);
    const k = key(s, e);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    emit(next);
  };

  const toggleSeason = (list: Episode[]) => {
    if (!selected) return;
    const allSel = list.every((ep) => selected.has(key(ep.season, ep.episode_number)));
    const next = new Set(selected);
    list.forEach((ep) => (allSel ? next.delete(key(ep.season, ep.episode_number)) : next.add(key(ep.season, ep.episode_number))));
    emit(next);
  };

  const toggleExpanded = (s: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  return (
    <Modal opened={opened} onClose={onClose} title={<span className="font-bold">Episodes · {title}</span>} size="sm" radius="md">
      <p className="text-xs text-[rgb(var(--color-text-tertiary))] mb-3">
        Include whole seasons or expand a season to pick specific episodes. Unchecked ones are skipped when scheduling.
      </p>

      {episodesQ.isLoading || selected === null ? (
        <p className="text-sm text-[rgb(var(--color-text-tertiary))]">Loading episodes…</p>
      ) : seasons.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-tertiary))]">No episodes found for this show yet.</p>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          <div className="flex items-center px-2 py-1.5 mb-1 border-b border-[rgb(var(--color-border-default))]">
            <Checkbox
              checked={selected.size === episodes.length}
              indeterminate={selected.size > 0 && selected.size < episodes.length}
              onChange={() =>
                emit(
                  selected.size === episodes.length
                    ? new Set()
                    : new Set(episodes.map((ep) => key(ep.season, ep.episode_number)))
                )
              }
              label={<span className="text-sm font-semibold">All seasons</span>}
            />
          </div>
          {seasons.map((s) => {
            const list = bySeason.get(s)!;
            const chosen = list.filter((ep) => selected.has(key(ep.season, ep.episode_number))).length;
            const isOpen = expanded.has(s);
            return (
              <div key={s} className="rounded-md border border-[rgb(var(--color-border-subtle))]">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <Checkbox
                    checked={chosen === list.length}
                    indeterminate={chosen > 0 && chosen < list.length}
                    onChange={() => toggleSeason(list)}
                    label={<span className="text-sm font-medium">Season {s}</span>}
                  />
                  <button
                    onClick={() => toggleExpanded(s)}
                    className="ml-auto inline-flex items-center gap-1 text-xs text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-secondary))]"
                  >
                    {chosen}/{list.length}
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </div>
                {isOpen && (
                  <div className="px-3 pb-2 pt-0.5 space-y-1.5 border-t border-[rgb(var(--color-border-subtle))]">
                    {list.map((ep) => (
                      <Checkbox
                        key={ep.id}
                        size="xs"
                        checked={selected.has(key(ep.season, ep.episode_number))}
                        onChange={() => toggleEp(ep.season, ep.episode_number)}
                        label={
                          <span className="text-xs text-[rgb(var(--color-text-secondary))]">
                            E{ep.episode_number}
                            {ep.title ? ` · ${ep.title}` : ''}
                          </span>
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Button fullWidth mt="md" variant="default" onClick={onClose} className="font-semibold">
        Done
      </Button>
    </Modal>
  );
}
