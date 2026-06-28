import { useState, useRef, useEffect } from 'react';
import { Menu, Collapse, RangeSlider, Select, Switch } from '@mantine/core';
import { Search, X, ChevronDown, Check, SlidersHorizontal } from 'lucide-react';
import {
  type DiscoverFilters,
  type DiscoverType,
  type DiscoverSort,
  type PickedEntity,
  type PickedPerson,
  SORT_LABELS,
  TYPE_LABELS,
  YEAR_MIN,
  YEAR_MAX,
} from './discoverTypes';
import {
  MOCK_GENRES,
  MOCK_PROVIDERS,
  MOCK_STUDIOS,
  MOCK_PEOPLE,
  MOCK_NETWORKS,
  LANGUAGES,
  RUNTIMES,
  CERTIFICATIONS,
  TV_STATUSES,
  TV_TYPES,
  ANIME_GENRES,
  SEASON_TERMS,
  ANIME_STATUSES,
  ANIME_TYPES,
  MOCK_ANIME_STUDIOS,
} from './discoverMockData';

interface DiscoverFilterBarProps {
  q: string;
  onQChange: (value: string) => void;
  filters: DiscoverFilters;
  onPatch: (patch: Partial<DiscoverFilters>) => void;
}

// min-h-[40px] gives a comfortable tap target on touch without bloating the row.
const trigger =
  'inline-flex items-center gap-1 min-h-[40px] py-1.5 text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-primary))] transition-colors';
const triggerActive = 'inline-flex items-center gap-1 min-h-[40px] py-1.5 text-[#646cff] font-medium';

const RATINGS = [6, 7, 8];

export function DiscoverFilterBar({ q, onQChange, filters, onPatch }: DiscoverFilterBarProps) {
  const [searchOpen, setSearchOpen] = useState(q.length > 0);
  const [panelOpen, setPanelOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const searchActive = q.trim().length > 0;
  const anime = filters.animeMode;

  // Genre control is data-driven so anime mode shows MAL genres.
  const genreList = anime ? ANIME_GENRES : MOCK_GENRES;
  const selectedGenres = anime ? filters.animeGenres : filters.genres;
  const toggleGenre = (slug: string) => {
    const has = selectedGenres.includes(slug);
    const next = has ? selectedGenres.filter((g) => g !== slug) : [...selectedGenres, slug];
    onPatch(anime ? { animeGenres: next } : { genres: next });
  };

  // Advanced count reflects whichever lane is active.
  const advCount = anime
    ? (filters.yearRange ? 1 : 0) +
      (filters.minRating ? 1 : 0) +
      (filters.season && filters.seasonYear ? 1 : 0) +
      (filters.animeStatus ? 1 : 0) +
      (filters.animeType ? 1 : 0) +
      filters.animeStudios.length
    : (filters.yearRange ? 1 : 0) +
      (filters.minRating ? 1 : 0) +
      (filters.provider ? 1 : 0) +
      filters.studios.length +
      filters.people.length +
      (filters.language ? 1 : 0) +
      (filters.runtime ? 1 : 0) +
      (filters.certification ? 1 : 0) +
      (filters.tvStatus ? 1 : 0) +
      (filters.tvType ? 1 : 0) +
      filters.networks.length +
      (filters.upcoming ? 1 : 0);

  const yr = filters.yearRange ?? [YEAR_MIN, YEAR_MAX];
  const showTvFields = filters.type !== 'movie';

  const clearAdvanced = () =>
    onPatch(
      anime
        ? { yearRange: null, minRating: null, season: null, seasonYear: null, animeStatus: null, animeType: null, animeStudios: [] }
        : {
            yearRange: null,
            minRating: null,
            provider: null,
            studios: [],
            people: [],
            language: null,
            runtime: null,
            certification: null,
            tvStatus: null,
            tvType: null,
            networks: [],
            upcoming: false,
          }
    );

  return (
    <div className="w-full">
      {/* Compact control row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {searchOpen ? (
          <div className="flex items-center gap-1.5 text-[rgb(var(--color-text-secondary))]">
            <Search size={15} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => onQChange(e.target.value)}
              onBlur={() => {
                if (!q) setSearchOpen(false);
              }}
              placeholder="Search titles"
              className="bg-transparent outline-none border-0 w-32 sm:w-48 text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-tertiary))]"
            />
            {q && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  onQChange('');
                  inputRef.current?.focus();
                }}
                className="inline-flex items-center justify-center w-9 h-9 -mr-2 text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-secondary))]"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
            className="inline-flex items-center justify-center w-10 h-10 -ml-2 text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
          >
            <Search size={18} />
          </button>
        )}

        <span className="h-4 w-px bg-[rgb(var(--color-border-default))]" />

        {/* Anime lane toggle */}
        <button
          type="button"
          onClick={() => onPatch({ animeMode: !anime })}
          className={`inline-flex items-center min-h-[36px] px-3 py-1.5 rounded-full text-xs transition-colors ${
            anime
              ? 'bg-[#646cff] text-white font-medium'
              : 'border border-[rgb(var(--color-border-default))] text-[rgb(var(--color-text-secondary))] hover:border-[#646cff]'
          }`}
        >
          Anime
        </button>

        {/* Type — hidden in anime mode (anime spans TV/Movie/OVA) */}
        {!anime && (
          <Menu shadow="sm" width={140} position="bottom-start">
            <Menu.Target>
              <button type="button" className={filters.type !== 'all' ? triggerActive : trigger}>
                {TYPE_LABELS[filters.type]} <ChevronDown size={13} />
              </button>
            </Menu.Target>
            <Menu.Dropdown>
              {(Object.keys(TYPE_LABELS) as DiscoverType[]).map((t) => (
                <Menu.Item key={t} fw={filters.type === t ? 600 : 400} onClick={() => onPatch({ type: t })}>
                  {TYPE_LABELS[t]}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        )}

        {/* Genre (multi) — anime or TMDB list */}
        <Menu shadow="sm" width={200} position="bottom-start" closeOnItemClick={false}>
          <Menu.Target>
            <button type="button" className={selectedGenres.length ? triggerActive : trigger}>
              {selectedGenres.length ? `Genre · ${selectedGenres.length}` : 'Genre'} <ChevronDown size={13} />
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            {genreList.map((g) => {
              const on = selectedGenres.includes(g.slug);
              return (
                <Menu.Item
                  key={g.slug}
                  onClick={() => toggleGenre(g.slug)}
                  fw={on ? 600 : 400}
                  rightSection={on ? <Check size={14} className="text-[#646cff]" /> : undefined}
                >
                  {g.name}
                </Menu.Item>
              );
            })}
          </Menu.Dropdown>
        </Menu>

        {/* Sort */}
        <Menu shadow="sm" width={150} position="bottom-start">
          <Menu.Target>
            <button type="button" className={trigger}>
              Sort: {SORT_LABELS[filters.sort]} <ChevronDown size={13} />
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            {(Object.keys(SORT_LABELS) as DiscoverSort[]).map((s) => (
              <Menu.Item key={s} fw={filters.sort === s ? 600 : 400} onClick={() => onPatch({ sort: s })}>
                {SORT_LABELS[s]}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>

        <span className="h-4 w-px bg-[rgb(var(--color-border-default))]" />

        {/* Reveal toggle */}
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          className={advCount ? triggerActive : trigger}
        >
          <SlidersHorizontal size={14} />
          Filters
          {advCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#646cff] text-white text-[11px] font-semibold">
              {advCount}
            </span>
          )}
          <ChevronDown
            size={13}
            style={{ transform: panelOpen ? 'rotate(180deg)' : undefined, transition: '150ms' }}
          />
        </button>
      </div>

      {/* Inline reveal panel (progressive disclosure, like the schedule page) */}
      <Collapse in={panelOpen}>
        <div className="mt-4 pt-4 border-t border-[rgb(var(--color-border-subtle))]">
          {/* Quality toggles — top of panel, always active (apply to wall, grid, search) */}
          <div className="pb-4 mb-4 border-b border-[rgb(var(--color-border-subtle))] flex flex-wrap items-center gap-x-8 gap-y-2">
            <Switch
              size="sm"
              color="indigo"
              checked={filters.hideAdult}
              onChange={(e) => onPatch({ hideAdult: e.currentTarget.checked })}
              label="Hide adult content"
              classNames={{ label: 'text-sm text-[rgb(var(--color-text-secondary))]' }}
            />
            <Switch
              size="sm"
              color="indigo"
              checked={filters.requireArtwork}
              onChange={(e) => onPatch({ requireArtwork: e.currentTarget.checked })}
              label="Only titles with artwork"
              classNames={{ label: 'text-sm text-[rgb(var(--color-text-secondary))]' }}
            />
          </div>
          <div className={searchActive ? 'opacity-40 pointer-events-none' : ''}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5 max-w-3xl">
            {/* Release years — granular range (spans full panel width) */}
            <div className="md:col-span-2">
              <Field label={`Release years · ${yr[0]}–${yr[1]}`}>
                <div className="px-2 pt-1 pb-5">
                  <RangeSlider
                    min={YEAR_MIN}
                    max={YEAR_MAX}
                    value={yr}
                    onChange={(val) =>
                      onPatch({ yearRange: val[0] === YEAR_MIN && val[1] === YEAR_MAX ? null : (val as [number, number]) })
                    }
                    minRange={0}
                    step={1}
                    color="indigo"
                    size="md"
                    thumbSize={22}
                    label={(v) => v}
                    marks={[
                      { value: 1970, label: '1970' },
                      { value: 1990, label: '1990' },
                      { value: 2010, label: '2010' },
                    ]}
                  />
                </div>
              </Field>
            </div>

            {/* Minimum rating / score */}
            <Field label={anime ? 'Minimum score' : 'Minimum rating'}>
              <PillRow>
                <Pill on={!filters.minRating} onClick={() => onPatch({ minRating: null })}>
                  Any
                </Pill>
                {RATINGS.map((r) => (
                  <Pill key={r} on={filters.minRating === r} onClick={() => onPatch({ minRating: r })}>
                    ★ {r}+
                  </Pill>
                ))}
              </PillRow>
            </Field>

            {anime ? (
              <>
                {/* Anime-native fields */}
                <Field label="Season">
                  <SeasonPicker
                    season={filters.season}
                    year={filters.seasonYear}
                    onChange={(season, seasonYear) => onPatch({ season, seasonYear })}
                  />
                  {filters.season && filters.seasonYear && (
                    <p className="mt-1.5 text-[11px] text-[rgb(var(--color-text-tertiary))] italic">
                      Seasonal lists come from their own Jikan endpoint — they don't combine with genre, status, studio, or score.
                    </p>
                  )}
                </Field>

                <Field label="Status">
                  <SelectPills
                    options={ANIME_STATUSES}
                    value={filters.animeStatus}
                    onChange={(v) => onPatch({ animeStatus: v })}
                  />
                </Field>

                <Field label="Type">
                  <SelectPills
                    options={ANIME_TYPES}
                    value={filters.animeType}
                    onChange={(v) => onPatch({ animeType: v })}
                  />
                </Field>

                <Field label="Studio">
                  <InlineEntityField
                    placeholder="Search anime studios"
                    options={MOCK_ANIME_STUDIOS}
                    selected={filters.animeStudios}
                    onPick={(o) => {
                      if (filters.animeStudios.some((s) => s.id === o.id)) return;
                      onPatch({ animeStudios: [...filters.animeStudios, { id: o.id, name: o.name }] });
                    }}
                    onRemove={(id) => onPatch({ animeStudios: filters.animeStudios.filter((s) => s.id !== id) })}
                  />
                </Field>
              </>
            ) : (
              <>
                {/* TMDB fields */}
                <Field label="Streaming service">
                  <PillRow>
                    <Pill on={!filters.provider} onClick={() => onPatch({ provider: null })}>
                      Any
                    </Pill>
                    {MOCK_PROVIDERS.map((p) => (
                      <Pill
                        key={p.id}
                        on={filters.provider?.id === p.id}
                        onClick={() => onPatch({ provider: { id: p.id, name: p.name } })}
                      >
                        {p.name}
                      </Pill>
                    ))}
                  </PillRow>
                </Field>

                <Field label="Studio">
                  <InlineEntityField
                    placeholder="Search studios"
                    options={MOCK_STUDIOS}
                    selected={filters.studios}
                    onPick={(o) => {
                      if (filters.studios.some((s) => s.id === o.id)) return;
                      onPatch({ studios: [...filters.studios, { id: o.id, name: o.name }] });
                    }}
                    onRemove={(id) => onPatch({ studios: filters.studios.filter((s) => s.id !== id) })}
                  />
                </Field>

                <Field label="Cast & crew">
                  <InlineEntityField
                    placeholder="Search people"
                    options={MOCK_PEOPLE}
                    selected={filters.people}
                    onPick={(o) => {
                      if (filters.people.some((p) => p.id === o.id)) return;
                      const department = (o as { department?: 'cast' | 'crew' }).department ?? 'cast';
                      onPatch({
                        people: [...filters.people, { id: o.id, name: o.name, department }] as PickedPerson[],
                      });
                    }}
                    onRemove={(id) => onPatch({ people: filters.people.filter((p) => p.id !== id) })}
                  />
                </Field>

                <Field label="Original language">
                  <SelectPills options={LANGUAGES} value={filters.language} onChange={(v) => onPatch({ language: v })} />
                </Field>

                <Field label="Runtime">
                  <SelectPills options={RUNTIMES} value={filters.runtime} onChange={(v) => onPatch({ runtime: v })} />
                </Field>

                <Field label="Content rating">
                  <SelectPills
                    options={CERTIFICATIONS}
                    value={filters.certification}
                    onChange={(v) => onPatch({ certification: v })}
                  />
                </Field>

                <Field label="Release">
                  <PillRow>
                    <Pill on={!filters.upcoming} onClick={() => onPatch({ upcoming: false })}>
                      All
                    </Pill>
                    <Pill on={filters.upcoming} onClick={() => onPatch({ upcoming: true })}>
                      Coming soon
                    </Pill>
                  </PillRow>
                </Field>

                <Field label="Broadcast network">
                  <InlineEntityField
                    placeholder="Search networks"
                    options={MOCK_NETWORKS}
                    selected={filters.networks}
                    onPick={(o) => {
                      if (filters.networks.some((n) => n.id === o.id)) return;
                      onPatch({ networks: [...filters.networks, { id: o.id, name: o.name }] });
                    }}
                    onRemove={(id) => onPatch({ networks: filters.networks.filter((n) => n.id !== id) })}
                  />
                </Field>

                {showTvFields && (
                  <>
                    <Field label="TV status">
                      <SelectPills
                        options={TV_STATUSES}
                        value={filters.tvStatus}
                        onChange={(v) => onPatch({ tvStatus: v })}
                      />
                    </Field>

                    <Field label="TV type">
                      <SelectPills options={TV_TYPES} value={filters.tvType} onChange={(v) => onPatch({ tvType: v })} />
                    </Field>
                  </>
                )}
              </>
            )}
          </div>

          {advCount > 0 && (
            <button
              type="button"
              onClick={clearAdvanced}
              className="mt-5 text-xs text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-primary))] underline underline-offset-2"
            >
              Clear advanced filters
            </button>
          )}

          {searchActive && (
            <p className="mt-3 text-xs text-[rgb(var(--color-text-tertiary))] italic">
              These apply when search is cleared.
            </p>
          )}
          </div>
        </div>
      </Collapse>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-2">{label}</p>
      {children}
    </div>
  );
}

function PillRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center min-h-[36px] px-3 py-1.5 rounded-full text-xs border transition-colors ${
        on
          ? 'border-[#646cff] text-[#646cff] bg-[#646cff]/5 font-medium'
          : 'border-[rgb(var(--color-border-default))] text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-text-tertiary))]'
      }`}
    >
      {children}
    </button>
  );
}

/** Two-field season picker: season term + year (Jikan /seasons/{year}/{season}). */
function SeasonPicker({
  season,
  year,
  onChange,
}: {
  season: string | null;
  year: number | null;
  onChange: (season: string | null, year: number | null) => void;
}) {
  const current = new Date().getFullYear();
  const years = Array.from({ length: current + 1 - 1960 + 1 }, (_, i) => `${current + 1 - i}`);
  return (
    <div className="flex items-center gap-2">
      <Select
        size="md"
        placeholder="Season"
        data={SEASON_TERMS}
        value={season}
        onChange={(v) => onChange(v, year)}
        clearable
        allowDeselect
        className="w-32"
        comboboxProps={{ withinPortal: true }}
      />
      <Select
        size="md"
        placeholder="Year"
        data={years}
        value={year ? String(year) : null}
        onChange={(v) => onChange(season, v ? Number(v) : null)}
        clearable
        searchable
        className="w-28"
        comboboxProps={{ withinPortal: true }}
      />
    </div>
  );
}

/** "Any" + single-select option pills bound to a string|null value. */
function SelectPills({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <PillRow>
      <Pill on={!value} onClick={() => onChange(null)}>
        Any
      </Pill>
      {options.map((o) => (
        <Pill key={o.value} on={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </Pill>
      ))}
    </PillRow>
  );
}

interface EntityOption extends PickedEntity {
  department?: 'cast' | 'crew';
}

interface InlineEntityFieldProps {
  placeholder: string;
  options: EntityOption[];
  selected: PickedEntity[];
  onPick: (option: EntityOption) => void;
  onRemove: (id: string) => void;
}

/**
 * Inline type-to-pick field. In the prototype it filters a hard-coded list; the
 * real component debounces against the discover API (companies / people).
 */
function InlineEntityField({ placeholder, options, selected, onPick, onRemove }: InlineEntityFieldProps) {
  const [query, setQuery] = useState('');
  const matches = query
    ? options
        .filter((o) => o.name.toLowerCase().includes(query.toLowerCase()) && !selected.some((s) => s.id === o.id))
        .slice(0, 5)
    : [];

  return (
    <div>
      <div className="flex items-center gap-1.5 px-2.5 h-10 rounded-md border border-[rgb(var(--color-border-default))] max-w-xs">
        <Search size={14} className="text-[rgb(var(--color-text-tertiary))]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="bg-transparent outline-none border-0 w-full text-sm text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-tertiary))]"
        />
      </div>

      {matches.length > 0 && (
        <ul className="mt-1 max-w-xs rounded-md border border-[rgb(var(--color-border-default))] overflow-hidden">
          {matches.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(o);
                  setQuery('');
                }}
                className="w-full flex items-center justify-between gap-2 px-3 min-h-[40px] py-2 text-xs text-left text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-bg-elevated))]"
              >
                {o.name}
                {o.department && (
                  <span className="text-[10px] uppercase tracking-wide text-[rgb(var(--color-text-tertiary))]">
                    {o.department}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-0.5 pl-3 pr-1 min-h-[32px] rounded-full bg-[rgb(var(--color-bg-elevated))] text-xs text-[rgb(var(--color-text-primary))]"
            >
              {s.name}
              <button
                type="button"
                aria-label={`Remove ${s.name}`}
                onClick={() => onRemove(s.id)}
                className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-primary))]"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
