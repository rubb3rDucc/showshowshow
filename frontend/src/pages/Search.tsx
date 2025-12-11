import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  TextInput,
  Card,
  Image,
  Text,
  Badge,
  Button,
  Group,
  Stack,
  Grid,
  Loader,
  Center,
  Alert,
  Pagination,
} from '@mantine/core';
import { IconSearch, IconPlus, IconCheck } from '@tabler/icons-react';
import { toast } from 'sonner';
import { searchContent, getContentByTmdbId, addToQueue } from '../api/content';
import type { SearchResult } from '../types/api';

export function Search() {
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Search query
  const { data, isLoading, error } = useQuery({
    queryKey: ['search', searchQuery, page],
    queryFn: () => searchContent(searchQuery, page),
    enabled: searchQuery.length > 0,
  });

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  // Add to queue mutation
  const addToQueueMutation = useMutation({
    mutationFn: async (result: SearchResult) => {
      // First, fetch/cache the content if not cached
      let contentId = result.cached_id;
      
      if (!contentId) {
        const content = await getContentByTmdbId(result.tmdb_id, result.content_type);
        contentId = content.id;
      }
      
      // Then add to queue
      return addToQueue(contentId);
    },
    onSuccess: () => {
      toast.success('Added to queue!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add to queue');
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchQuery(query.trim());
      setPage(1); // Reset to first page on new search
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Search</h1>
          <p className="text-gray-600">
            Find shows and movies to add to your queue
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch}>
          <TextInput
            size="lg"
            placeholder="Search for shows and movies..."
            leftSection={<IconSearch size={20} />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rightSection={
              isLoading ? <Loader size="sm" /> : null
            }
          />
        </form>

        {/* Error State */}
        {error && (
          <Alert color="red" title="Error">
            Failed to search. Please try again.
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <Center py={60}>
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text c="dimmed">Searching...</Text>
            </Stack>
          </Center>
        )}

        {/* Empty State */}
        {!searchQuery && !isLoading && (
          <Card shadow="sm" padding="xl" radius="md" withBorder>
            <Center py={40}>
              <Stack align="center" gap="sm">
                <IconSearch size={48} stroke={1.5} opacity={0.3} />
                <Text size="lg" fw={500} c="dimmed">
                  Start searching
                </Text>
                <Text size="sm" c="dimmed">
                  Enter a show or movie title above
                </Text>
              </Stack>
            </Center>
          </Card>
        )}

        {/* No Results */}
        {searchQuery && !isLoading && data && data.results.length === 0 && (
          <Card shadow="sm" padding="xl" radius="md" withBorder>
            <Center py={40}>
              <Stack align="center" gap="sm">
                <Text size="lg" fw={500} c="dimmed">
                  No results found
                </Text>
                <Text size="sm" c="dimmed">
                  Try a different search term
                </Text>
              </Stack>
            </Center>
          </Card>
        )}

        {/* Results Grid */}
        {data && data.results.length > 0 && (
          <>
            <Group justify="space-between" align="center">
              <Text size="sm" c="dimmed">
                Found {data.total_results} results (Page {data.page} of {data.total_pages})
              </Text>
            </Group>
            
            <Grid>
              {data.results.map((result) => (
                <Grid.Col key={`${result.tmdb_id}-${result.content_type}`} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                  <Card shadow="sm" padding="lg" radius="md" withBorder h="100%">
                    <Card.Section>
                      {result.poster_url ? (
                        <Image
                          src={result.poster_url}
                          height={300}
                          alt={result.title}
                          fit="cover"
                        />
                      ) : (
                        <div
                          style={{
                            height: 300,
                            backgroundColor: '#f0f0f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text c="dimmed">No poster</Text>
                        </div>
                      )}
                    </Card.Section>

                    <Stack gap="sm" mt="md">
                      <Group justify="space-between" align="flex-start">
                        <Text fw={600} lineClamp={2} style={{ flex: 1 }}>
                          {result.title}
                        </Text>
                      </Group>

                      <Group gap="xs">
                        <Badge variant="light" size="sm">
                          {result.content_type === 'tv' ? 'TV Show' : 'Movie'}
                        </Badge>
                        {result.is_cached && (
                          <Badge variant="light" color="green" size="sm">
                            Cached
                          </Badge>
                        )}
                      </Group>

                      {result.release_date && (
                        <Text size="sm" c="dimmed">
                          {new Date(result.release_date).getFullYear()}
                        </Text>
                      )}

                      <Text size="sm" c="dimmed" lineClamp={3}>
                        {result.overview || 'No description available'}
                      </Text>

                      <Button
                        fullWidth
                        leftSection={
                          result.is_cached ? <IconCheck size={16} /> : <IconPlus size={16} />
                        }
                        onClick={() => addToQueueMutation.mutate(result)}
                        loading={addToQueueMutation.isPending}
                        variant={result.is_cached ? 'light' : 'filled'}
                      >
                        Add to Queue
                      </Button>
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>

            {/* Pagination */}
            {data.total_pages > 1 && (
              <Center mt="xl">
                <Pagination
                  value={page}
                  onChange={setPage}
                  total={data.total_pages}
                  siblings={1}
                  boundaries={1}
                />
              </Center>
            )}
          </>
        )}
      </div>
    </div>
  );
}


