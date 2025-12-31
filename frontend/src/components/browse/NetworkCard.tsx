interface NetworkCardProps {
  network: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  onClick: () => void;
}

export function NetworkCard({ network, onClick }: NetworkCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white border-2 border-gray-900 p-4 hover:bg-gray-100 transition-all hover:scale-105 cursor-pointer group w-full"
    >
      {network.logo_url ? (
        <div className="flex items-center justify-center h-16">
          <img 
            src={network.logo_url}
            alt={network.name}
            className="max-h-14 w-auto object-contain"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-16">
          <div className="bg-gray-900 text-white px-2 py-1 text-[10px] font-black tracking-widest uppercase text-center">
            {network.name}
          </div>
        </div>
      )}
    </button>
  );
}

