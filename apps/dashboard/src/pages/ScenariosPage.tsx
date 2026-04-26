export const ScenariosPage = () => {
  // TODO: fetch from scenarios-api
  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scenarios</h1>
          <p className="mt-1 text-sm text-gray-500">
            Define automated rules and actions for user events
          </p>
        </div>
        <button className="py-2 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg transition-colors text-sm">
          New Scenario
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm text-gray-500 text-center py-8">
          No scenarios defined yet. Create one to get started.
        </p>
      </div>
    </div>
  );
};
