import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Button, Loader, Center } from '@mantine/core';
import { useLocation } from 'wouter';
import { ArrowLeft, Tv, Settings } from 'lucide-react';
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
import { getNetworks, reorderNetworks } from '../api/networks';
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
    isDragging,
  } = useSortable({ id: network.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: 'none',
    opacity: isDragging ? 0.3 : 1,
    // Stagger animation delay for each card
    animationDelay: isEditMode ? `${index * 0.02}s` : '0s',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isEditMode ? 'animate-jiggle' : ''}
      {...(isEditMode ? { ...attributes, ...listeners } : {})}
    >
      <NetworkCard 
        network={network} 
        onClick={isEditMode ? () => {} : onClick}
      />
    </div>
  );
}

export function AllNetworks() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

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
    useSensor(PointerSensor),
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

  const activeNetwork = activeId ? localNetworks?.find(n => n.id === activeId) : null;

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
        {/* Back button and header */}
        <div className="mb-8">
          <Button
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
            onClick={() => setLocation('/')}
            className="mb-6"
          >
            Back to Browse
          </Button>

          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <Tv size={32} strokeWidth={2.5} className="text-gray-700" />
              <div>
                <h1 className="text-3xl font-black uppercase tracking-wider">
                  All Networks
                </h1>
                <p className="text-sm text-gray-600 font-mono">
                  {localNetworks?.length || 0} networks available
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={isEditMode ? "filled" : "outline"}
                onClick={() => setIsEditMode(!isEditMode)}
                className={isEditMode 
                  ? "bg-black text-white border-2 border-black font-black uppercase" 
                  : "border-2 border-gray-900 font-black uppercase"
                }
              >
                {isEditMode ? "Done Editing" : "Edit Order"}
              </Button>
              <Button
                variant="outline"
                leftSection={<Settings size={16} />}
                onClick={() => setLocation('/networks/manage')}
                className="border-2 border-gray-900 font-black uppercase"
              >
                Manage
              </Button>
            </div>
          </div>
        </div>

        {/* Grid with drag-and-drop */}
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {localNetworks.map((network, index) => (
                    <SortableNetworkCard
                      key={network.id}
                      network={network}
                      onClick={() => setLocation(`/?network=${network.id}`)}
                      isEditMode={isEditMode}
                      index={index}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeNetwork ? (
                  <div className="opacity-90">
                    <NetworkCard network={activeNetwork} onClick={() => {}} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {localNetworks.map((network) => (
                <NetworkCard
                  key={network.id}
                  network={network}
                  onClick={() => setLocation(`/?network=${network.id}`)}
                />
              ))}
            </div>
          )
        ) : (
          <div className="bg-white border-2 border-gray-900 p-12 text-center">
            <p className="font-bold text-gray-600">No networks available</p>
          </div>
        )}
      </Container>
    </div>
  );
}


