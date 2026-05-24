import { BookOpen } from "lucide-react";

// Stub — full documentation lands at the very end of the project.
export const DocsPage = () => (
  <div className="p-8 max-w-6xl mx-auto">
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900">Documentation</h1>
      <p className="mt-1 text-sm text-gray-500">
        Guides and API reference for integrating UserCore.
      </p>
    </div>
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
      <div className="mb-3 flex justify-center text-primary-600">
        <BookOpen size={40} strokeWidth={1.5} />
      </div>
      <h2 className="text-lg font-semibold text-gray-900">Coming soon</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
        Documentation is on the way.
      </p>
    </div>
  </div>
);
