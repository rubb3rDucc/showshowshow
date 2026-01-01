import { LazyImage } from './LazyImage';

interface NetworkCardProps {
  network: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  onClick: () => void;
  disablePointerEvents?: boolean;
}

export function NetworkCard({ network, onClick, disablePointerEvents = false }: NetworkCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white border-2 border-gray-900 p-5 sm:p-6 hover:bg-gray-100 transition-all hover:scale-105 cursor-pointer group w-full aspect-square flex items-center justify-center"
      style={{ pointerEvents: disablePointerEvents ? 'none' : 'auto' }}
    >
      {network.logo_url && network.logo_url.trim() !== '' ? (
        <div className="flex items-center justify-center h-full w-full">
          <LazyImage 
            src={network.logo_url}
            alt={network.name}
            className="max-h-12 sm:max-h-16 md:max-h-20 w-auto object-contain"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-full w-full">
          <div className="bg-gray-900 text-white px-3 py-2 text-xs sm:text-sm font-black tracking-widest uppercase text-center">
            {network.name}
          </div>
        </div>
      )}
    </button>
  );
}

