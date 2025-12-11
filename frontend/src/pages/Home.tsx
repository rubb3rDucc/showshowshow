export function Home() {
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Welcome to ShowShowShow</h1>
          <p className="text-gray-600">
            Your personal TV schedule manager
          </p>
        </div>

        {/* Call to Action */}
        <div className="p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
          <h2 className="text-xl font-semibold mb-2">Ready to create your schedule?</h2>
          <p className="text-gray-700 mb-4">
            Add shows to your queue and generate a personalized viewing schedule
          </p>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Create Schedule
          </button>
        </div>

        {/* Schedule Placeholder */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            Your Schedule Will Appear Here
          </h3>
          <p className="text-gray-500">
            Once you create a schedule, you'll see your weekly viewing calendar
          </p>
        </div>
      </div>
    </div>
  );
}


