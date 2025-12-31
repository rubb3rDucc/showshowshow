import { useQuery } from '@tanstack/react-query';
import { Loader, Center, Text } from '@mantine/core';
import { NetworkCard } from './NetworkCard';
import { getNetworks } from '../../api/networks';

interface NetworkGridProps {
  onNetworkClick: (networkId: string) => void;
}

export function NetworkGrid({ onNetworkClick }: NetworkGridProps) {
  const { data: networks, isLoading, error } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
  });

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
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gray-900 text-white px-2 py-1 text-[10px] font-black tracking-widest">
          NETWORKS
        </div>
        <h2 className="text-2xl font-black uppercase tracking-wider">
          Browse by Network
        </h2>
      </div>
      
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 py-4">
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
      </div>
    </section>
  );
}

