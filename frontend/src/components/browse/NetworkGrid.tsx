import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Text, Button } from '@mantine/core';
import { Tv, ChevronRight } from 'lucide-react';
import { NetworkCard } from './NetworkCard';
import { SectionHeader } from './SectionHeader';
import { getNetworks } from '../../api/networks';

interface NetworkGridProps {
  onNetworkClick: (networkId: string) => void;
  onSeeAllNetworks?: () => void;
  limit?: number;
}

export function NetworkGrid({ onNetworkClick, onSeeAllNetworks, limit = 12 }: NetworkGridProps) {
  const [clickedNetworkId, setClickedNetworkId] = useState<string | null>(null);
  
  const { data: allNetworks, isLoading, error } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
  });

  const networks = limit ? allNetworks?.slice(0, limit) : allNetworks;
  const hasMoreNetworks = allNetworks && allNetworks.length > (limit || 0);

  const handleNetworkClick = (networkId: string) => {
    setClickedNetworkId(networkId);
    onNetworkClick(networkId);
  };

  // Skeleton component for loading cards
  const NetworkCardSkeleton = () => (
    <div className="flex-shrink-0 w-32 animate-pulse">
      <div className="bg-gray-200 border-2 border-[rgb(var(--color-border-default))] aspect-square rounded" />
    </div>
  );

  if (isLoading) {
    return (
      <section className="mb-12">
        <SectionHeader
          title="Networks"
          icon={<Tv size={20} strokeWidth={2.5} />}
          onSeeAll={onSeeAllNetworks}
        />
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 py-4">
          <div className="flex gap-4">
            {[...Array(12)].map((_, i) => (
              <NetworkCardSkeleton key={`skeleton-${i}`} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-12">
        <SectionHeader
          title="Networks"
          icon={<Tv size={20} strokeWidth={2.5} />}
          onSeeAll={onSeeAllNetworks}
        />
      <div className="bg-red-100 border-2 border-red-900 p-6 text-center">
        <Text className="font-bold text-red-900">
          Failed to load networks. Please try again.
        </Text>
      </div>
      </section>
    );
  }

  if (!networks || networks.length === 0) {
  return (
    <section className="mb-12">
        <SectionHeader
          title="Networks"
          icon={<Tv size={20} strokeWidth={2.5} />}
          onSeeAll={onSeeAllNetworks}
        />
        <div className="bg-[rgb(var(--color-bg-elevated))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm p-8 text-center">
          <Tv size={48} className="mx-auto mb-4 text-gray-400" />
          <Text className="font-bold text-lg mb-2">No networks yet</Text>
          <Text className="text-sm text-[rgb(var(--color-text-secondary))] mb-4">
            Add networks to start browsing shows
          </Text>
          {onSeeAllNetworks && (
          <Button
              variant="outline"
              onClick={onSeeAllNetworks}
              className="border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm font-semibold"
            >
              Add Networks
          </Button>
        )}
      </div>
      </section>
    );
  }

  return (
    <section className="mb-12">
      <SectionHeader
        title="Networks"
        icon={<Tv size={20} strokeWidth={2.5} />}
        onSeeAll={onSeeAllNetworks}
      />
      
      <div className="relative">
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 py-4">
          <div className="flex gap-4">
            {networks.map((network) => (
              <div key={network.id} className="flex-shrink-0 w-32">
                <NetworkCard
                  network={network}
                  onClick={() => handleNetworkClick(network.id)}
                  isClicked={clickedNetworkId === network.id}
                />
              </div>
            ))}
            {/* Peek indicator if more networks exist */}
            {hasMoreNetworks && (
              <div className="flex-shrink-0 w-8 flex items-center justify-center opacity-50">
                <ChevronRight className="text-gray-400" size={24} />
              </div>
            )}
          </div>
        </div>
        {/* Gradient fade on right edge */}
        {hasMoreNetworks && (
          <div className="absolute right-0 top-4 bottom-4 w-20 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none hidden md:block" />
        )}
      </div>
    </section>
  );
}

