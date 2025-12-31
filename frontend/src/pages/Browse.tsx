import { Container, Text, Button, Stack } from '@mantine/core';
import { useLocation } from 'wouter';
import { Search as SearchIcon } from 'lucide-react';

export function Browse() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <Container size="xl" className="py-8 md:py-16">
        <Stack align="center" gap="xl" className="text-center">
          {/* Coming Soon Section */}
          <div className="max-w-2xl">
            <div className="text-8xl mb-6">🎬</div>
            <Text size="4xl" fw={700} className="mb-4 text-gray-900">
              Browse is Coming Soon
            </Text>
            <Text size="lg" c="dimmed" className="mb-8">
              We're building an amazing content discovery experience with:
            </Text>
            
            {/* Feature List */}
            <div className="text-left bg-white border-2 border-gray-900 p-8 mb-8">
              <Stack gap="md">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🔥</div>
                  <Text size="md" fw={500}>Trending shows and movies</Text>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl">📺</div>
                  <Text size="md" fw={500}>Browse by network (HBO, Netflix, Disney+, etc.)</Text>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🎭</div>
                  <Text size="md" fw={500}>Quick theme filters (90s TV, Anime, Thrillers)</Text>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl">⚡</div>
                  <Text size="md" fw={500}>Quick episodes under 30 minutes</Text>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl">📊</div>
                  <Text size="md" fw={500}>Popular content this week</Text>
                </div>
              </Stack>
            </div>

            {/* Temporary Search Link */}
            <Button
              size="lg"
              className="bg-black text-white border-2 border-black font-black uppercase tracking-wider"
              radius="xs"
              leftSection={<SearchIcon size={20} />}
              onClick={() => setLocation('/search')}
            >
              USE SEARCH FOR NOW
            </Button>
          </div>
        </Stack>
      </Container>
    </div>
  );
}

