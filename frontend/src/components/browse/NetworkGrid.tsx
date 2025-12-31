import { useQuery } from '@tanstack/react-query';
import { Loader, Center, Text } from '@mantine/core';
import { Tv } from 'lucide-react';
import { NetworkCard } from './NetworkCard';
import { SectionHeader } from './SectionHeader';
import { getNetworks } from '../../api/networks';

interface NetworkGridProps {
  onNetworkClick: (networkId: string) => void;
  onSeeAllNetworks?: () => void;
  limit?: number;
}

export function NetworkGrid({ onNetworkClick, onSeeAllNetworks, limit = 12 }: NetworkGridProps) {
  const { data: allNetworks, isLoading, error } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
  });

  const networks = limit ? allNetworks?.slice(0, limit) : allNetworks;

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
      <SectionHeader
        title="Browse by Network"
        icon={<Tv size={20} strokeWidth={2.5} />}
        onSeeAll={onSeeAllNetworks}
      />
      
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 py-4">
        <div className="flex gap-4">
          {networks?.map((network) => (
            <div key={network.id} className="flex-shrink-0 w-32">
              <NetworkCard
                network={network}
                onClick={() => onNetworkClick(network.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

