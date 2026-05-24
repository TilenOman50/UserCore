import { WorkspaceTab } from "../../features/settings/WorkspaceTab";

export const GeneralSettingsPage = () => (
  <div className="p-8 max-w-6xl mx-auto">
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900">General</h1>
      <p className="mt-1 text-sm text-gray-500">
        Workspace name and other general settings.
      </p>
    </div>
    <WorkspaceTab />
  </div>
);
