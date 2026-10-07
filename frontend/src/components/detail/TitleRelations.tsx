import { useLocation } from 'wouter';
import { animeHref } from '../../utils/contentHref';
import { ExternalLink } from 'lucide-react';
import type { TitleRelation, RelatedEntry } from '../../types/titleDetail';

/**
 * Sequels, prequels, side stories and source material, grouped by relation.
 * Anime open in the app; manga has no page here, so it links out.
 */
export function TitleRelations({ relations }: { relations: TitleRelation[] }) {
  return (
    <dl className="space-y-3">
      {relations.map((group) => (
        <div key={group.label} className="grid grid-cols-[110px_1fr] gap-3 items-baseline">
          <dt className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-tertiary))]">
            {group.label}
          </dt>
          <dd className="flex flex-wrap gap-2 min-w-0">
            {group.entries.map((entry) => (
              <RelatedEntryLink key={`${entry.media}-${entry.id}`} entry={entry} />
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const pill =
  'inline-flex items-center gap-1.5 max-w-full px-3 py-1.5 rounded-full border border-[rgb(var(--color-border-default))] bg-[rgb(var(--color-bg-surface))] text-sm font-semibold hover:border-[rgb(var(--color-accent))] transition-colors';

function RelatedEntryLink({ entry }: { entry: RelatedEntry }) {
  const [, setLocation] = useLocation();

  if (entry.external_url) {
    return (
      <a
        href={entry.external_url}
        target="_blank"
        rel="noopener noreferrer"
        className={pill}
        title={entry.original_title ?? undefined}
      >
        <span className="truncate">{entry.title}</span>
        {entry.media === 'manga' && (
          <span className="text-xs font-normal text-[rgb(var(--color-text-tertiary))]">Manga</span>
        )}
        <ExternalLink size={12} className="shrink-0 text-[rgb(var(--color-text-tertiary))]" />
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setLocation(animeHref(entry.id));
        window.scrollTo({ top: 0 });
      }}
      className={pill}
      title={entry.original_title ?? undefined}
    >
      <span className="truncate">{entry.title}</span>
    </button>
  );
}
