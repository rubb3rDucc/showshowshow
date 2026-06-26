import { useState } from 'react';
import { Loader, Center, Stack, Text } from '@mantine/core';
import { ChevronUp, ChevronDown, Eye, EyeOff, SlidersHorizontal } from 'lucide-react';
import { useHomeData } from '../hooks/useHomeData';
import { useHomeLayout } from '../hooks/useHomeLayout';
import { TonightSection } from '../components/home/TonightSection';
import { SearchWidget } from '../components/home/SearchWidget';
import { ContinueWatching } from '../components/home/ContinueWatching';
import { NeedsYou } from '../components/home/NeedsYou';
import { Recap } from '../components/home/Recap';

const WIDGETS = [
  { id: 'tonight', label: 'Tonight' },
  { id: 'quick-add', label: 'Quick add' },
  { id: 'up-next', label: 'Up next' },
  { id: 'needs-you', label: 'Needs you' },
  { id: 'recap', label: 'This week' },
] as const;
const WIDGET_IDS = WIDGETS.map((w) => w.id);

function IconButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`p-1.5 rounded-md transition-colors ${
        disabled
          ? 'text-[rgb(var(--color-border-default))] cursor-default'
          : 'text-[rgb(var(--color-text-secondary))] hover:text-[#646cff] hover:bg-[rgb(var(--color-bg-page))] cursor-pointer'
      }`}
    >
      {children}
    </button>
  );
}

export function Home() {
  const {
    nowItem,
    earlierItems,
    laterItems,
    comingUpItems,
    hasScheduleButNothingYet,
    hasScheduleButAllEnded,
    isInGap,
    dates,
    isLoading,
  } = useHomeData();

  const { order, isHidden, moveUp, moveDown, toggleHidden } = useHomeLayout(WIDGET_IDS);
  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return (
      <Center py={60}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading...</Text>
        </Stack>
      </Center>
    );
  }

  const elements: Record<string, React.ReactNode> = {
    'tonight': (
      <TonightSection
        nowItem={nowItem}
        earlierItems={earlierItems}
        laterItems={laterItems}
        comingUpItems={comingUpItems}
        hasScheduleButNothingYet={hasScheduleButNothingYet}
        hasScheduleButAllEnded={hasScheduleButAllEnded}
        isInGap={isInGap}
        dateString={dates.today}
      />
    ),
    'quick-add': <SearchWidget />,
    'up-next': <ContinueWatching />,
    'needs-you': <NeedsYou />,
    'recap': <Recap />,
  };

  return (
    <div className="px-4 py-8 md:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setEditing((e) => !e)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[rgb(var(--color-text-tertiary))] hover:text-[#646cff] transition-colors cursor-pointer"
          >
            <SlidersHorizontal size={13} />
            {editing ? 'Done' : 'Edit layout'}
          </button>
        </div>

        {editing ? (
          <div className="space-y-2">
            {order.map((id, idx) => {
              const meta = WIDGETS.find((w) => w.id === id);
              const hidden = isHidden(id);
              return (
                <div
                  key={id}
                  className={`flex items-center gap-1 px-3 py-2.5 rounded-lg border border-[rgb(var(--color-border-default))] bg-[rgb(var(--color-bg-surface))] ${
                    hidden ? 'opacity-50' : ''
                  }`}
                >
                  <span className="flex-1 text-sm font-medium text-[rgb(var(--color-text-primary))]">
                    {meta?.label ?? id}
                  </span>
                  <IconButton label="Move up" disabled={idx === 0} onClick={() => moveUp(id)}>
                    <ChevronUp size={16} />
                  </IconButton>
                  <IconButton
                    label="Move down"
                    disabled={idx === order.length - 1}
                    onClick={() => moveDown(id)}
                  >
                    <ChevronDown size={16} />
                  </IconButton>
                  <IconButton
                    label={hidden ? 'Show widget' : 'Hide widget'}
                    onClick={() => toggleHidden(id)}
                  >
                    {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                  </IconButton>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {order
              .filter((id) => !isHidden(id))
              .map((id) => (
                <div key={id}>{elements[id]}</div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
