import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Button, TextInput, Loader, Center, Modal, Text, Tabs } from '@mantine/core';
import { useLocation } from 'wouter';
import { ArrowLeft, Search, Plus, Trash2, Tv, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getNetworks, reorderNetworks, searchNetworks, addNetwork, deleteNetwork, type NetworkSearchResult } from '../api/networks';
import { NetworkCard } from '../components/browse/NetworkCard';

interface SortableNetworkCardProps {
  network: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  onClick: () => void;
  isEditMode: boolean;
  index: number;
}

function SortableNetworkCard({ network, onClick, isEditMode, index }: SortableNetworkCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: network.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none' as const,
    animationDelay: isEditMode ? `${index * 0.02}s` : '0s',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isEditMode ? 'animate-jiggle cursor-grab active:cursor-grabbing' : ''}
      {...(isEditMode ? { ...attributes, ...listeners } : {})}
    >
      <NetworkCard 
        network={network} 
        onClick={isEditMode ? () => {} : onClick}
        disablePointerEvents={isEditMode}
      />
    </div>
  );
}

export function Networks() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'browse' | 'add'>('browse');
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<NetworkSearchResult[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [networkToDelete, setNetworkToDelete] = useState<{ id: string; name: string } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);

  // Get existing networks
  const { data: allNetworks, isLoading } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
  });

  const [localNetworks, setLocalNetworks] = useState<typeof allNetworks>(allNetworks);

  // Update local networks when data changes from the query
  if (allNetworks && localNetworks !== allNetworks) {
    setLocalNetworks(allNetworks);
  }

  const reorderMutation = useMutation({
    mutationFn: reorderNetworks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networks'] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && localNetworks) {
      const oldIndex = localNetworks.findIndex((n) => n.id === active.id);
      const newIndex = localNetworks.findIndex((n) => n.id === over.id);

      const newOrder = arrayMove(localNetworks, oldIndex, newIndex);
      setLocalNetworks(newOrder);

      // Save to backend
      reorderMutation.mutate(newOrder.map((n) => n.id));
    }

    setActiveId(null);
  };

  // Auto-search with debouncing
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);

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
    addNetworkMutation.mutate({ tmdbId, isProvider });
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
    return allNetworks?.some(n => n.tmdb_network_id === tmdbId);
  };

  const activeNetwork = activeId ? localNetworks?.find(n => n.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[rgb(var(--color-bg-page))]">
        <Center py={60}>
          <Loader size="lg" />
        </Center>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg-page))]">
      <Container size="xl" className="py-4 md:py-8 px-2 md:px-4">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
            onClick={() => setLocation('/browse')}
            className="mb-6"
          >
            Back to Browse
          </Button>

          <div className="mb-4">
            <div className="flex items-center gap-4 mb-2">
              <Tv size={32} strokeWidth={2.5} className="text-gray-700" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Manage Networks
                </h1>
                <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                  Reorder the first 12 networks to control what appears on the Browse page
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(v) => setActiveTab(v as 'browse' | 'add')}>
          <Tabs.List className="mb-6 border-b-2 border-gray-900">
            <Tabs.Tab 
              value="browse" 
              className="font-semibold data-[active=true]:border-b-4 data-[active=true]:border-gray-900"
            >
              Your Networks ({allNetworks?.length || 0})
            </Tabs.Tab>
            <Tabs.Tab 
              value="add" 
              className="font-semibold data-[active=true]:border-b-4 data-[active=true]:border-gray-900"
            >
              Add Networks
            </Tabs.Tab>
          </Tabs.List>

          {/* Browse Tab */}
          <Tabs.Panel value="browse">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                Networks marked{' '}
                <span className="bg-black text-white px-2 py-1 text-xs font-semibold inline-block">
                  FEATURED
                </span>
                {' '}appear on Browse
              </p>
              <Button
                variant={isEditMode ? "filled" : "outline"}
                onClick={() => setIsEditMode(!isEditMode)}
                className={isEditMode 
                  ? "bg-teal-600 hover:bg-teal-700 text-white border-0 font-semibold" 
                  : "border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm font-semibold"
                }
                size="sm"
              >
                {isEditMode ? "Done Editing" : "Reorder Networks"}
              </Button>
            </div>

            {/* Grid with featured indicator */}
            {localNetworks && localNetworks.length > 0 ? (
              isEditMode ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={localNetworks.map((n) => n.id)}
                    strategy={rectSortingStrategy}
                  >
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {localNetworks.slice(0, 12).map((network, index) => (
                          <div key={network.id} className="relative">
                            <div className="absolute -top-2 -right-2 bg-black text-white text-[10px] font-semibold px-2 py-1 z-10 border-2 border-white">
                              FEATURED
                            </div>
                            <SortableNetworkCard
                              network={network}
                              onClick={() => setLocation(`/browse?network=${network.id}`)}
                              isEditMode={isEditMode}
                              index={index}
                            />
                          </div>
                        ))}
                      </div>
                      {localNetworks.length > 12 && (
                        <div className="my-8">
                          <div className="border-t-4 border-[rgb(var(--color-border-default))] relative">
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 bg-[rgb(var(--color-bg-page))] px-4">
                              <span className="text-xs font-semibold text-[rgb(var(--color-text-tertiary))]">
                                Additional Networks
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      {localNetworks.length > 12 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                          {localNetworks.slice(12).map((network, index) => (
                            <div key={network.id} className="relative">
                              <SortableNetworkCard
                                network={network}
                                onClick={() => setLocation(`/browse?network=${network.id}`)}
                                isEditMode={isEditMode}
                                index={index + 12}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  </SortableContext>
                  <DragOverlay>
                    {activeNetwork ? (
                      <div className="opacity-90 rotate-2 scale-105">
                        <NetworkCard network={activeNetwork} onClick={() => {}} />
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {localNetworks.slice(0, 12).map((network) => (
                      <div key={network.id} className="relative">
                        <div className="absolute -top-2 -right-2 bg-black text-white text-[10px] font-semibold px-2 py-1 z-10 border-2 border-white">
                          FEATURED
                        </div>
                        <NetworkCard
                          network={network}
                          onClick={() => setLocation(`/browse?network=${network.id}`)}
                        />
                      </div>
                    ))}
                  </div>
                  {localNetworks.length > 12 && (
                    <div className="my-8">
                      <div className="border-t-4 border-[rgb(var(--color-border-default))] relative">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 bg-[rgb(var(--color-bg-page))] px-4">
                          <span className="text-xs font-semibold text-[rgb(var(--color-text-tertiary))]">
                            Additional Networks
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {localNetworks.length > 12 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                      {localNetworks.slice(12).map((network) => (
                        <NetworkCard
                          key={network.id}
                          network={network}
                          onClick={() => setLocation(`/browse?network=${network.id}`)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )
            ) : (
              <div className="bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm p-12 text-center">
                <p className="font-bold text-[rgb(var(--color-text-secondary))]">No networks available</p>
              </div>
            )}
          </Tabs.Panel>

          {/* Add Tab */}
          <Tabs.Panel value="add">
            {/* Search Section */}
            <div className="bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm p-6 mb-8">
              <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center justify-between">
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
                    input: 'border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm',
                  }}
                />
              </div>
              <p className="text-xs text-[rgb(var(--color-text-tertiary))]">
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
                  <h3 className="mb-3 text-[rgb(var(--color-text-secondary))]">
                    Search Results
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {searchResults.map((network) => (
                      <div
                        key={network.tmdb_id}
                        className="bg-[rgb(var(--color-bg-page))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm p-4 flex flex-col items-center gap-3"
                      >
                        {network.logo_url ? (
                          <img
                            src={network.logo_url}
                            alt={network.name}
                            className="max-h-8 sm:max-h-10 md:max-h-12 w-auto object-contain"
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
                          <p className="text-[10px] text-[rgb(var(--color-text-tertiary))]">
                            {network.origin_country}
                          </p>
                        )}
                        <Button
                          size="xs"
                          className="w-full bg-teal-600 hover:bg-teal-700 text-white border-0 font-semibold text-[10px] hover:bg-gray-900"
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

            {/* Current Networks for Deletion */}
            <div className="bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold tracking-tight mb-4">
                Your Networks ({allNetworks?.length || 0})
              </h2>
              {allNetworks && allNetworks.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {allNetworks.map((network) => (
                    <div
                      key={network.id}
                      className="bg-[rgb(var(--color-bg-page))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm p-4 flex flex-col items-center gap-3 group relative"
                    >
                      {network.logo_url ? (
                        <img
                          src={network.logo_url}
                          alt={network.name}
                          className="max-h-8 sm:max-h-10 md:max-h-12 w-auto object-contain"
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
                        className="w-full border-2 font-semibold text-[10px]"
                        leftSection={<Trash2 size={12} />}
                        onClick={() => handleDeleteClick(network.id, network.name)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-[rgb(var(--color-text-tertiary))]">
                  <p className="font-normal">No networks added yet. Search above to add some!</p>
                </div>
              )}
            </div>
          </Tabs.Panel>
        </Tabs>
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
              <Text size="sm" className="text-[rgb(var(--color-text-secondary))]">
                This will remove the network from your collection. Content from this network will remain in your library.
              </Text>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              className="border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm font-bold"
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

