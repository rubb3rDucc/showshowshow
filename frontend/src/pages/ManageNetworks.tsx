import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Button, TextInput, Loader, Center, Modal, Text } from '@mantine/core';
import { useLocation } from 'wouter';
import { ArrowLeft, Search, Plus, Trash2, Tv, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { getNetworks, searchNetworks, addNetwork, deleteNetwork, type NetworkSearchResult } from '../api/networks';

export function ManageNetworks() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<NetworkSearchResult[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [networkToDelete, setNetworkToDelete] = useState<{ id: string; name: string } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const queryClient = useQueryClient();
  const searchTimeoutRef = useRef<number | null>(null);

  // Get existing networks
  const { data: existingNetworks, isLoading } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
  });

  // Auto-search with debouncing
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Don't search if query is less than 2 characters
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    // Set loading state
    setIsSearching(true);

    // Debounce search by 500ms
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchNetworks(searchQuery.trim());
        setSearchResults(results.results);
        setHasSearched(true);
        
        if (results.results.length === 0) {
          toast.info('No networks found', {
            description: `No results for "${searchQuery.trim()}"`,
          });
        }
      } catch (error) {
        console.error('Search failed:', error);
        toast.error('Search failed', {
          description: error instanceof Error ? error.message : 'Something went wrong',
        });
        setSearchResults([]);
        setHasSearched(true);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Add network mutation
  const addNetworkMutation = useMutation({
    mutationFn: ({ tmdbId, isProvider }: { tmdbId: number; isProvider: boolean }) => addNetwork(tmdbId, isProvider),
    onSuccess: (data) => {
      if (data.already_exists) {
        toast.info('Network already exists', {
          description: `${data.name} is already in your collection`,
        });
      } else {
        toast.success('Network added!', {
          description: `${data.name} has been added to your networks`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['networks'] });
      // Don't clear search after adding - keep results visible
    },
    onError: (error: Error) => {
      toast.error('Failed to add network', {
        description: error.message || 'Something went wrong',
      });
    },
  });

  // Delete network mutation
  const deleteNetworkMutation = useMutation({
    mutationFn: deleteNetwork,
    onSuccess: (data) => {
      toast.success('Network removed', {
        description: `${data.deleted_network} has been removed`,
      });
      queryClient.invalidateQueries({ queryKey: ['networks'] });
      setDeleteModalOpen(false);
      setNetworkToDelete(null);
    },
    onError: (error: Error) => {
      toast.error('Failed to remove network', {
        description: error.message || 'Something went wrong',
      });
    },
  });

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
  };

  const handleAddNetwork = (tmdbId: number, isProvider: boolean = false) => {
    addNetworkMutation.mutate({ tmdbId, isProvider }, {
      onSuccess: () => {
        // Keep search results visible after adding
      },
    });
  };

  const handleDeleteClick = (id: string, name: string) => {
    setNetworkToDelete({ id, name });
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (networkToDelete) {
      deleteNetworkMutation.mutate(networkToDelete.id);
    }
  };

  const isNetworkAdded = (tmdbId: number) => {
    return existingNetworks?.some(n => n.tmdb_network_id === tmdbId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Center py={60}>
          <Loader size="lg" />
        </Center>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Container size="xl" className="py-4 md:py-8 px-2 md:px-4">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
            onClick={() => setLocation('/')}
            className="mb-6"
          >
            Back to Browse
          </Button>

          <div className="flex items-center gap-4 mb-2">
            <Tv size={32} strokeWidth={2.5} className="text-gray-700" />
            <div>
              <h1 className="text-3xl font-black uppercase tracking-wider">
                Manage Networks
              </h1>
              <p className="text-sm text-gray-600 font-mono">
                Search and add networks from TMDB
              </p>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-white border-2 border-gray-900 p-6 mb-8">
          <h2 className="text-xl font-black uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>Search for Networks</span>
            {searchQuery && (
              <Button
                size="xs"
                variant="subtle"
                onClick={handleClearSearch}
                leftSection={<X size={14} />}
              >
                Clear
              </Button>
            )}
          </h2>
          <div className="flex gap-2 mb-3">
            <TextInput
              placeholder="Type to search TMDB (min 2 characters)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftSection={<Search size={16} />}
              rightSection={isSearching ? <Loader size={16} /> : null}
              className="flex-1"
              classNames={{
                input: 'border-2 border-gray-900 font-mono',
              }}
            />
          </div>
          <p className="text-xs text-gray-500 font-mono">
            {searchQuery.length > 0 && searchQuery.length < 2 
              ? `Type ${2 - searchQuery.length} more character to search...`
              : searchQuery.length >= 2
              ? isSearching 
                ? 'Searching...'
                : hasSearched
                ? `Found ${searchResults.length} network${searchResults.length === 1 ? '' : 's'}`
                : ''
              : 'Start typing to search for networks (e.g., HBO, G4, BBC)'
            }
          </p>

          {/* Search Results */}
          {hasSearched && searchResults.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-black uppercase tracking-wider mb-3 text-gray-600">
                Search Results
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {searchResults.map((network) => (
                  <div
                    key={network.tmdb_id}
                    className="bg-gray-50 border-2 border-gray-900 p-4 flex flex-col items-center gap-3"
                  >
                    {network.logo_url ? (
                      <img
                        src={network.logo_url}
                        alt={network.name}
                        className="h-12 w-auto object-contain"
                      />
                    ) : (
                      <div className="h-12 flex items-center justify-center">
                        <Tv size={32} className="text-gray-400" />
                      </div>
                    )}
                    <p className="text-xs font-bold text-center line-clamp-2">
                      {network.name}
                    </p>
                    {network.origin_country && (
                      <p className="text-[10px] text-gray-500 font-mono">
                        {network.origin_country}
                      </p>
                    )}
                    <Button
                      size="xs"
                      className="w-full bg-black text-white border-2 border-black font-black uppercase text-[10px] hover:bg-gray-900"
                      leftSection={<Plus size={12} />}
                      onClick={() => handleAddNetwork(network.tmdb_id, network.is_provider)}
                      disabled={isNetworkAdded(network.tmdb_id) || addNetworkMutation.isPending}
                    >
                      {isNetworkAdded(network.tmdb_id) ? 'Added' : 'Add'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Current Networks */}
        <div className="bg-white border-2 border-gray-900 p-6">
          <h2 className="text-xl font-black uppercase tracking-wider mb-4">
            Your Networks ({existingNetworks?.length || 0})
          </h2>
          {existingNetworks && existingNetworks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {existingNetworks.map((network) => (
                <div
                  key={network.id}
                  className="bg-gray-50 border-2 border-gray-900 p-4 flex flex-col items-center gap-3 group relative"
                >
                  {network.logo_url ? (
                    <img
                      src={network.logo_url}
                      alt={network.name}
                      className="h-12 w-auto object-contain"
                    />
                  ) : (
                    <div className="h-12 flex items-center justify-center">
                      <Tv size={32} className="text-gray-400" />
                    </div>
                  )}
                  <p className="text-xs font-bold text-center line-clamp-2">
                    {network.name}
                  </p>
                  <Button
                    size="xs"
                    variant="outline"
                    color="red"
                    className="w-full border-2 font-black uppercase text-[10px]"
                    leftSection={<Trash2 size={12} />}
                    onClick={() => handleDeleteClick(network.id, network.name)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="font-mono">No networks added yet. Search above to add some!</p>
            </div>
          )}
        </div>
      </Container>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Remove Network"
        centered
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-1" size={20} />
            <div>
              <Text className="font-bold mb-2">
                Are you sure you want to remove "{networkToDelete?.name}"?
              </Text>
              <Text size="sm" className="text-gray-600">
                This will remove the network from your collection. Content from this network will remain in your library.
              </Text>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              className="border-2 border-gray-900 font-bold"
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleConfirmDelete}
              loading={deleteNetworkMutation.isPending}
              className="bg-red-600 font-bold"
            >
              Remove Network
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

