import { useQuery } from '@tanstack/react-query';
import { Container, Button, Loader, Center } from '@mantine/core';
import { useLocation } from 'wouter';
import { ArrowLeft, Tv } from 'lucide-react';
import { getNetworks } from '../api/networks';
import { NetworkCard } from '../components/browse/NetworkCard';

export function AllNetworks() {
  const [, setLocation] = useLocation();

  const { data: networks, isLoading } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
  });

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

          <div className="flex items-center gap-4 mb-2">
            <Tv size={32} strokeWidth={2.5} className="text-gray-700" />
            <div>
              <h1 className="text-3xl font-black uppercase tracking-wider">
                All Networks
              </h1>
              <p className="text-sm text-gray-600 font-mono">
                {networks?.length || 0} networks available
              </p>
            </div>
          </div>
        </div>

        {/* Grid */}
        {networks && networks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {networks.map((network) => (
              <NetworkCard
                key={network.id}
                network={network}
                onClick={() => setLocation(`/?network=${network.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white border-2 border-gray-900 p-12 text-center">
            <p className="font-bold text-gray-600">No networks available</p>
          </div>
        )}
      </Container>
    </div>
  );
}


