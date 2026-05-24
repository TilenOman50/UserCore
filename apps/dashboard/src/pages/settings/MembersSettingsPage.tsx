import { Navigate } from "react-router-dom";

import { MembersTab } from "../../features/settings/MembersTab";
import { useWorkspace } from "../../lib/workspaceContext";

export const MembersSettingsPage = () => {
  const { role } = useWorkspace();
  const canManageMembers = role === "owner" || role === "admin";
  if (!canManageMembers) return <Navigate to="/settings/general" replace />;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <MembersTab />
    </div>
  );
};
