import { LazyImage } from './LazyImage';

interface NetworkCardProps {
  network: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  onClick: () => void;
  disablePointerEvents?: boolean;
  isClicked?: boolean;
}

export function NetworkCard({ network, onClick, disablePointerEvents = false, isClicked = false }: NetworkCardProps) {
  return (
    <button
      onClick={onClick}
      className={`bg-white dark:bg-gray-100 border-2 border-gray-300 hover:border-gray-400 rounded-lg shadow-sm hover:shadow-md p-5 sm:p-6 hover:bg-gray-50 transition-all duration-300 ease-out hover:-translate-y-1 cursor-pointer group w-full aspect-square flex items-center justify-center ${
        isClicked ? 'opacity-50 pointer-events-none' : ''
      }`}
      style={{ pointerEvents: disablePointerEvents ? 'none' : 'auto' }}
      disabled={isClicked}
    >
      {network.logo_url && network.logo_url.trim() !== '' ? (
        <div className="flex items-center justify-center h-full w-full">
          <LazyImage
            src={network.logo_url}
            alt={network.name}
            className="max-h-8 sm:max-h-10 md:max-h-12 w-auto object-contain"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-full w-full">
          <div className="bg-gray-900 text-white px-3 py-2 text-xs sm:text-sm font-semibold rounded-md text-center">
            {network.name}
          </div>
        </div>
      )}
    </button>
  );
}

