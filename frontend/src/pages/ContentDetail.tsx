import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Container, Button, Loader, Center, Tabs, Rating } from '@mantine/core';
import { ArrowLeft, Plus, ListPlus, Trash2, Star, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { getEpisodesByContentId } from '../api/content';
import {
  checkLibrary,
  addToLibrary,
  updateLibraryItem,
  removeFromLibrary,
} from '../api/library';
import { libraryItemToUI } from '../utils/library.utils';
import { formatFullDate } from '../utils/format';
import type { LibraryStatus } from '../types/library.types';
import { useAddToQueue, isAlreadyInQueueError } from '../hooks/useAddToQueue';
import { EpisodeTracker } from '../components/library/EpisodeTracker';
import { RelatedTitles } from '../components/discover/RelatedTitles';
import { TitleRelations } from '../components/detail/TitleRelations';
import { SeasonPicker } from '../components/detail/SeasonPicker';
import { SeasonTabs } from '../components/library/SeasonTabs';
import { useTitleDetail } from '../hooks/useTitleDetail';
import type { TitleCredit, TitleSource } from '../types/titleDetail';

const STATUS_OPTIONS: { value: LibraryStatus; label: string }[] = [
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
  { value: 'plan_to_watch', label: 'Plan to watch' },
  { value: 'dropped', label: 'Dropped' },
];

// Remount per title: wouter keeps this instance when only the params change, so hopping
// title-to-title via "More like this" would otherwise carry over the season, tab, etc.
// /content/tv/:tmdbId, /content/movie/:tmdbId, or /content/anime/:malId
export function ContentDetail() {
  const params = useParams<{ type: string; id: string }>();
  const id = Number(params.id);
  const source: TitleSource =
    params.type === 'anime'
      ? { kind: 'anime', malId: id }
      : { kind: 'tmdb', type: params.type === 'movie' ? 'movie' : 'tv', tmdbId: id };
  return <ContentDetailView key={`${params.type}/${params.id}`} source={source} />;
}

function ContentDetailView({ source }: { source: TitleSource }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const isAnime = source.kind === 'anime';

  // When we arrived from the library quick-look modal, send the back button there
  // (the library page reopens the modal via ?open=<contentId>) instead of history.back().
  const handleBack = () => {
    const q = new URLSearchParams(window.location.search);
    const cid = q.get('cid');
    if (q.get('from') === 'lib' && cid) {
      setLocation(`/library?open=${cid}`);
    } else {
      window.history.back();
    }
  };

  const [activeTab, setActiveTab] = useState<string | null>('cast');
  const [season, setSeason] = useState(1);

  // Resolve + cache the content (returns a stable UUID id), plus credits and extras
  const { detail, isLoading, error, creditsLoading } = useTitleDetail(source);
  const content = detail?.content;
  const contentId = content?.id;
  const isShow = content?.content_type === 'show';

  const { data: libraryCheck } = useQuery({
    queryKey: ['library-check', contentId],
    queryFn: () => checkLibrary(contentId!),
    enabled: !!contentId,
  });

  const libraryItem = libraryCheck?.in_library ? libraryCheck.library_item : undefined;
  const inLibrary = !!libraryItem;

  const { data: episodes, isLoading: episodesLoading } = useQuery({
    queryKey: ['content-episodes', contentId, season],
    queryFn: () => getEpisodesByContentId(contentId!, season),
    enabled: !!contentId && isShow && !inLibrary,
  });

  // ---- Mutations ----
  const addToQueueMutation = useAddToQueue();

  const handleAddToQueue = () => {
    if (!contentId) return;
    addToQueueMutation.mutate(
      { contentId },
      {
        onSuccess: () => toast.success('Added to lineup'),
        onError: (err) =>
          toast[isAlreadyInQueueError(err) ? 'info' : 'error'](
            isAlreadyInQueueError(err) ? 'Already in your lineup' : 'Failed to add to lineup'
          ),
      }
    );
  };

  const addToLibraryMutation = useMutation({
    mutationFn: () => addToLibrary({ content_id: contentId!, status: 'plan_to_watch' }),
    onSuccess: () => {
      toast.success('Added to library');
      queryClient.invalidateQueries({ queryKey: ['library-check', contentId] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
    onError: () => toast.error('Failed to add to library'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { status?: LibraryStatus; score?: number | null }) =>
      updateLibraryItem(libraryItem!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-check', contentId] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
    onError: () => toast.error('Failed to update'),
  });

  const removeMutation = useMutation({
    mutationFn: () => removeFromLibrary(libraryItem!.id),
    onSuccess: () => {
      toast.success('Removed from library');
      queryClient.invalidateQueries({ queryKey: ['library-check', contentId] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
    onError: () => toast.error('Failed to remove'),
  });

  // ---- Derived ----
  const crewByDepartment = useMemo(
    () =>
      detail?.crew.reduce((acc, member) => {
        const dept = member.department || 'Other';
        (acc[dept] ??= []).push(member);
        return acc;
      }, {} as Record<string, TitleCredit[]>) ?? {},
    [detail]
  );
  const directors = crewByDepartment['Directing']?.filter((m) => m.role === 'Director') ?? [];
  const year = content?.first_air_date?.split('-')[0] ?? content?.release_date?.split('-')[0];
  // Anime arrive one season per entry, so an episode count says more than "1 season"
  const showEpisodeCount = isAnime && content?.number_of_episodes != null;

  if (isLoading) {
    return (
      <Center className="h-[60vh]">
        <Loader size="lg" />
      </Center>
    );
  }

  if (error || !content) {
    return (
      <Container size="xl" className="py-8">
        <div className="bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm p-12 text-center">
          <p className="font-bold text-red-600 mb-2">Couldn’t load this title</p>
          <p className="text-sm text-[rgb(var(--color-text-secondary))]">
            {error instanceof Error ? error.message : 'Content not found'}
          </p>
        </div>
      </Container>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg-page))]">
      {/* ===== Cinematic hero ===== */}
      <div className="relative">
        {/* Backdrop */}
        <div className="absolute inset-0 overflow-hidden bg-gray-900">
          {content.backdrop_url ? (
            <img
              src={content.backdrop_url}
              alt=""
              aria-hidden
              className="w-full h-full object-cover object-center"
            />
          ) : (
            content.poster_url && (
              // No landscape image: a blurred poster keeps the hero from looking broken
              <img
                src={content.poster_url}
                alt=""
                aria-hidden
                className="w-full h-full object-cover object-center scale-125 blur-2xl opacity-70"
              />
            )
          )}
          {/* Left scrim keeps the title/meta legible regardless of the image */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
          {/* Single tall vertical fade: dark up top, smoothly into the page at the bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgb(var(--color-bg-page))] via-black/45 to-black/25" />
        </div>

        <Container size="xl" className="relative px-4 sm:px-6 pt-4 sm:pt-6 pb-10 sm:pb-14">
          {/* Back */}
          <Button
            variant="white"
            leftSection={<ArrowLeft size={16} />}
            onClick={handleBack}
            size="sm"
            className="mb-6 sm:mb-10 font-semibold shadow-sm"
          >
            Back
          </Button>

          <div className="flex flex-col sm:flex-row gap-5 sm:gap-8 items-center sm:items-end pt-20 sm:pt-32">
            {/* Poster */}
            <div className="flex-shrink-0">
              {content.poster_url ? (
                <img
                  src={content.poster_url}
                  alt={content.title}
                  className="w-44 sm:w-56 aspect-[2/3] object-cover rounded-lg shadow-2xl ring-1 ring-black/20"
                />
              ) : (
                <div className="w-44 sm:w-56 aspect-[2/3] rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 text-sm font-semibold">
                  NO POSTER
                </div>
              )}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0 text-center sm:text-left text-white pb-1 [text-shadow:0_2px_12px_rgba(0,0,0,0.7)]">
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight break-words">
                {content.title}
              </h1>
              {detail.original_title && (
                <p className="mt-1 text-base sm:text-lg text-white/70 break-words">{detail.original_title}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-sm text-white/85">
                {year && <span className="font-bold">{year}</span>}
                {showEpisodeCount && isShow && (
                  <span>
                    {content.number_of_episodes} episode{content.number_of_episodes === 1 ? '' : 's'}
                  </span>
                )}
                {!showEpisodeCount && content.number_of_seasons != null && isShow && (
                  <span>
                    {content.number_of_seasons} season{content.number_of_seasons === 1 ? '' : 's'}
                  </span>
                )}
                {content.rating && (
                  <span className="px-1.5 py-0.5 border border-white/40 rounded text-xs font-semibold">
                    {content.rating}
                  </span>
                )}
                {content.status && <span>{formatStatus(content.status)}</span>}
              </div>
              {(detail.studios.length > 0 || detail.genres.length > 0) && (
                <div className="mt-2 text-sm text-white/80">
                  {[detail.studios.join(', '), detail.genres.join(', ')].filter(Boolean).join(' · ')}
                </div>
              )}
              {directors.length > 0 && (
                <div className="mt-2 text-sm text-white/80">
                  Directed by{' '}
                  {directors.map((d, i) => (
                    <span key={`${d.person_id ?? d.name}`}>
                      {i > 0 && ', '}
                      {d.person_id != null ? (
                        <button
                          onClick={() => setLocation(`/people/${d.person_id}`)}
                          className="font-bold text-white hover:underline"
                        >
                          {d.name}
                        </button>
                      ) : (
                        <span className="font-bold text-white">{d.name}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Container>
      </div>

      {/* ===== Body ===== */}
      <Container size="xl" className="px-4 sm:px-6 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 lg:gap-10">
          {/* Main column */}
          <div className="min-w-0 space-y-8">
            {/* Synopsis */}
            {content.overview && (
              <section>
                <p className="text-[15px] leading-relaxed text-[rgb(var(--color-text-primary))] max-w-2xl">
                  {content.overview}
                </p>
              </section>
            )}

            {/* Release date (movies have no episode list) */}
            {!isShow && content.release_date && (
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                Release date: {formatFullDate(content.release_date)}
              </p>
            )}

            {/* Cast & crew */}
            <section>
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List className="border-b border-[rgb(var(--color-border-default))] mb-4">
                  <Tabs.Tab value="cast" className="font-semibold text-sm">
                    Cast
                  </Tabs.Tab>
                  <Tabs.Tab value="crew" className="font-semibold text-sm">
                    Crew
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="cast">
                  {creditsLoading ? (
                    <Center className="py-8">
                      <Loader size="sm" />
                    </Center>
                  ) : detail.cast.length ? (
                    <div className="flex flex-wrap gap-2">
                      {detail.cast.slice(0, 40).map((actor, i) => (
                        <CreditChip
                          key={`${actor.person_id ?? actor.name}-${i}`}
                          credit={actor}
                          title={actor.role ? `as ${actor.role}` : undefined}
                          onOpen={(id) => setLocation(`/people/${id}`)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[rgb(var(--color-text-tertiary))] py-2">
                      No cast information available
                    </p>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="crew">
                  {creditsLoading ? (
                    <Center className="py-8">
                      <Loader size="sm" />
                    </Center>
                  ) : detail.crew.length ? (
                    <div className="space-y-4">
                      {Object.entries(crewByDepartment).map(([dept, members]) => (
                        <div key={dept}>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-tertiary))] mb-2">
                            {dept}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {members.map((member) => (
                              <CreditChip
                                key={`${member.person_id ?? member.name}-${member.role}`}
                                credit={member}
                                onOpen={(id) => setLocation(`/people/${id}`)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[rgb(var(--color-text-tertiary))] py-2">
                      No crew information available
                    </p>
                  )}
                </Tabs.Panel>
              </Tabs>
            </section>

            {/* Episodes (shows) */}
            {isShow && (
              <section>
                <h2 className="text-lg font-bold tracking-tight mb-4">Episodes</h2>
                {detail.seasons.length > 0 && (
                  <SeasonPicker seasons={detail.seasons} currentMalId={content.mal_id} />
                )}
                {inLibrary ? (
                  <EpisodeTracker libraryItem={libraryItemToUI(libraryItem!)} />
                ) : (
                  <ReadOnlyEpisodes
                    seasons={content.number_of_seasons ?? 1}
                    season={season}
                    onSeasonChange={setSeason}
                    episodes={episodes}
                    loading={episodesLoading}
                  />
                )}
              </section>
            )}

            {/* Sequels, prequels, source material */}
            {detail.relations.length > 0 && (
              <section>
                <h2 className="text-lg font-bold tracking-tight mb-4">Related</h2>
                <TitleRelations relations={detail.relations} />
              </section>
            )}
          </div>

          {/* Action rail */}
          <aside className="lg:sticky lg:top-6 self-start">
            <div className="bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm p-4 space-y-4">
              {inLibrary ? (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-tertiary))] mb-2">
                      Status
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {STATUS_OPTIONS.map((opt) => {
                        const active = libraryItem!.status === opt.value;
                        return (
                          <Button
                            key={opt.value}
                            size="xs"
                            variant={active ? 'filled' : 'default'}
                            color={active ? 'teal' : undefined}
                            onClick={() => updateMutation.mutate({ status: opt.value })}
                            className="font-semibold"
                          >
                            {opt.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-tertiary))] mb-2">
                      Your score
                    </p>
                    <Rating
                      count={10}
                      value={libraryItem!.score ?? 0}
                      onChange={(v) => updateMutation.mutate({ score: v || null })}
                      size="xl"
                      emptySymbol={<Star size={28} className="text-gray-300" />}
                      fullSymbol={<Star size={28} className="text-teal-500 fill-teal-500" />}
                    />
                  </div>

                  {/* Separated from the score above so a stray tap while rating
                      doesn't hit a button */}
                  <div className="pt-3 border-t border-[rgb(var(--color-border-subtle))] space-y-2">
                    <Button
                      fullWidth
                      color="teal"
                      leftSection={<ListPlus size={16} />}
                      onClick={handleAddToQueue}
                      loading={addToQueueMutation.isPending}
                      className="font-semibold"
                    >
                      Add to Lineup
                    </Button>
                    <Button
                      fullWidth
                      variant="subtle"
                      color="red"
                      leftSection={<Trash2 size={16} />}
                      onClick={() => removeMutation.mutate()}
                      loading={removeMutation.isPending}
                      className="font-semibold"
                    >
                      Remove from library
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Button
                    fullWidth
                    color="teal"
                    leftSection={<Plus size={16} />}
                    onClick={() => addToLibraryMutation.mutate()}
                    loading={addToLibraryMutation.isPending}
                    className="font-semibold"
                  >
                    Add to Library
                  </Button>
                  <Button
                    fullWidth
                    variant="default"
                    leftSection={<ListPlus size={16} />}
                    onClick={handleAddToQueue}
                    loading={addToQueueMutation.isPending}
                    className="font-semibold"
                  >
                    Add to Lineup
                  </Button>
                </>
              )}

              {detail.streaming.length > 0 && (
                <div className="pt-3 border-t border-[rgb(var(--color-border-subtle))]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-tertiary))] mb-2">
                    Where to watch
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {detail.streaming.map((s) => (
                      <a
                        key={s.name}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-[rgb(var(--color-border-default))] text-xs font-semibold hover:border-[rgb(var(--color-accent))] transition-colors"
                      >
                        {s.name}
                        <ExternalLink size={12} className="text-[rgb(var(--color-text-tertiary))]" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        {source.kind === 'tmdb' ? (
          <RelatedTitles type={source.type} tmdbId={source.tmdbId} className="mt-10 sm:mt-14" />
        ) : (
          <RelatedTitles items={detail.recommendations} className="mt-10 sm:mt-14" />
        )}
      </Container>
    </div>
  );
}

// "finished_airing" (anime) or "Returning Series" (TMDB) -> "Finished airing" / "Returning Series"
function formatStatus(status: string): string {
  const spaced = status.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** A person pill; links to their page only when they have one here */
function CreditChip({
  credit,
  title,
  onOpen,
}: {
  credit: TitleCredit;
  title?: string;
  onOpen: (personId: number) => void;
}) {
  const className =
    'inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-full border border-[rgb(var(--color-border-default))] bg-[rgb(var(--color-bg-surface))]';
  const body = (
    <>
      <span className="text-sm font-semibold">{credit.name}</span>
      {credit.role && (
        <span className="text-xs text-[rgb(var(--color-text-tertiary))] truncate max-w-[140px]">
          {credit.role}
        </span>
      )}
    </>
  );
  return credit.person_id != null ? (
    <button
      onClick={() => onOpen(credit.person_id!)}
      className={`${className} hover:border-[rgb(var(--color-accent))] transition-colors`}
      title={title}
    >
      {body}
    </button>
  ) : (
    <span className={className} title={title}>
      {body}
    </span>
  );
}

interface ReadOnlyEpisodesProps {
  seasons: number;
  season: number;
  onSeasonChange: (s: number) => void;
  episodes: Awaited<ReturnType<typeof getEpisodesByContentId>> | undefined;
  loading: boolean;
}

function ReadOnlyEpisodes({
  seasons,
  season,
  onSeasonChange,
  episodes,
  loading,
}: ReadOnlyEpisodesProps) {
  return (
    <div className="space-y-4">
      {seasons > 1 && (
        <SeasonTabs
          tabs={Array.from({ length: seasons }, (_, i) => ({ key: i + 1, label: `Season ${i + 1}` }))}
          activeKey={season}
          onSelect={(key) => onSeasonChange(Number(key))}
        />
      )}
      {loading ? (
        <Center className="py-8">
          <Loader size="sm" />
        </Center>
      ) : episodes?.length ? (
        // Same rows as the library's EpisodeTracker, minus the watched checkbox
        <ul className="divide-y divide-[rgb(var(--color-border-subtle))] border border-[rgb(var(--color-border-subtle))] overflow-hidden rounded-md">
          {episodes.map((ep) => (
            <li key={ep.id} className="flex items-center gap-4 p-3 md:p-4 bg-[rgb(var(--color-bg-surface))]">
              <div className="flex flex-col min-w-0">
                <span className="text-sm md:text-base font-medium text-[rgb(var(--color-text-primary))] truncate">
                  {ep.title || `Episode ${ep.episode_number}`}
                </span>
                <span className="text-[10px] md:text-xs font-medium text-[rgb(var(--color-text-tertiary))]">
                  Episode {ep.episode_number}
                  {ep.air_date && ` · ${formatFullDate(ep.air_date)}`}
                </span>
                {ep.overview && (
                  <span className="text-xs text-[rgb(var(--color-text-secondary))] mt-1 line-clamp-2">
                    {ep.overview}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[rgb(var(--color-text-tertiary))] py-2">
          No episodes available
        </p>
      )}
    </div>
  );
}
