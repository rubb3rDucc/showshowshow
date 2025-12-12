import { Link } from 'wouter';
import { Button, Group } from '@mantine/core';
import { ScheduleView } from '../components/schedule/ScheduleView';
import { useAuthStore } from '../stores/authStore';

export function Home() {
  const { user } = useAuthStore();

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Group justify="space-between" align="center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Your Schedule</h1>
            <p className="text-gray-600">
              Welcome back, {user?.email}!
            </p>
          </div>
          <Link href="/queue">
            <Button>Go to Queue</Button>
          </Link>
        </Group>

        {/* Schedule View */}
        <ScheduleView />
      </div>
    </div>
  );
}


