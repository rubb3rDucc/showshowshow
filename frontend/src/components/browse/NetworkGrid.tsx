import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader, Center, Text, Button } from '@mantine/core';
import { Tv } from 'lucide-react';
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
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { NetworkCard } from './NetworkCard';
import { SectionHeader } from './SectionHeader';
import { getNetworks, reorderNetworks } from '../../api/networks';

interface NetworkGridProps {
  onNetworkClick: (networkId: string) => void;
  onSeeAllNetworks?: () => void;
  limit?: number;
  enableDragDrop?: boolean;
}

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
    // Stagger animation delay for each card
    animationDelay: isEditMode ? `${index * 0.02}s` : '0s',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex-shrink-0 w-32 ${isEditMode ? 'animate-jiggle cursor-grab active:cursor-grabbing' : ''}`}
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

export function NetworkGrid({ onNetworkClick, onSeeAllNetworks, limit = 12, enableDragDrop = false }: NetworkGridProps) {
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const { data: allNetworks, isLoading, error } = useQuery({
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
        distance: 8, // Require 8px of movement before starting drag
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

  const networks = limit ? localNetworks?.slice(0, limit) : localNetworks;
  const activeNetwork = activeId ? localNetworks?.find(n => n.id === activeId) : null;

  if (isLoading) {
    return (
      <Center py={40}>
        <Loader size="lg" />
      </Center>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border-2 border-red-900 p-6 text-center">
        <Text className="font-bold text-red-900">
          Failed to load networks. Please try again.
        </Text>
      </div>
    );
  }

  if (!networks || networks.length === 0) {
    return (
      <div className="bg-gray-100 border-2 border-gray-900 p-6 text-center">
        <Text className="font-bold">No networks available</Text>
      </div>
    );
  }

  return (
    <section className="mb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-4">
        <SectionHeader
          title="Networks"
          icon={<Tv size={20} strokeWidth={2.5} />}
          onSeeAll={onSeeAllNetworks}
        />
        {enableDragDrop && (
          <Button
            variant={isEditMode ? "filled" : "outline"}
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
            className={isEditMode 
              ? "bg-black text-white border-2 border-black font-black uppercase" 
              : "border-2 border-gray-900 font-black uppercase"
            }
          >
            {isEditMode ? "Done Editing" : "Edit Order"}
          </Button>
        )}
      </div>
      
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 py-4">
        {enableDragDrop && isEditMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={networks.map((n) => n.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex gap-4">
                {networks.map((network, index) => (
                  <SortableNetworkCard
                    key={network.id}
                    network={network}
                    onClick={() => onNetworkClick(network.id)}
                    isEditMode={isEditMode}
                    index={index}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeNetwork ? (
                <div className="flex-shrink-0 w-32 opacity-90 rotate-2 scale-105">
                  <NetworkCard network={activeNetwork} onClick={() => {}} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="flex gap-4">
            {networks.map((network) => (
              <div key={network.id} className="flex-shrink-0 w-32">
                <NetworkCard
                  network={network}
                  onClick={() => onNetworkClick(network.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

