export function Queue() {
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Queue</h1>
          <p className="text-gray-600">
            Your playlist of shows to schedule
          </p>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            Queue is Empty
          </h3>
          <p className="text-gray-500 mb-4">
            Add shows from search to build your queue
          </p>
          <p className="text-sm text-gray-400">
            Think of this like a playlist builder - add shows, reorder them, then generate your schedule
          </p>
        </div>
      </div>
    </div>
  );
}


