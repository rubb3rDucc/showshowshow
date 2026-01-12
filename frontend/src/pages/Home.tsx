import { Loader, Center, Stack, Text } from '@mantine/core';
import { useHomeData } from '../hooks/useHomeData';
import { LastNightSection } from '../components/home/LastNightSection';
import { TonightSection } from '../components/home/TonightSection';
import { ComingUp } from '../components/home/ComingUp';
import { PlanAffordance } from '../components/home/PlanAffordance';

export function Home() {
  const {
    lastNight,
    nowItem,
    earlierItems,
    laterItems,
    comingUpItems,
    hasScheduleButNothingYet,
    hasScheduleButAllEnded,
    isInGap,
    tomorrowCount,
    dates,
    isLoading,
  } = useHomeData();

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

  return (
    <div className="px-4 py-8 md:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        {/* Tonight Section - main content (moved to top) */}
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

        {/* Last Night Section - only shows if there are unwatched items from yesterday */}
        <LastNightSection items={lastNight} dateString={dates.yesterday} />

        {/* Coming Up - tomorrow indicator */}
        <ComingUp tomorrowCount={tomorrowCount} />

        {/* Plan Affordance - subtle link to create schedule */}
        <PlanAffordance />
      </div>
    </div>
  );
}
