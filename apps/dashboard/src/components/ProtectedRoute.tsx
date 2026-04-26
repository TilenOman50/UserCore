import { Navigate, Outlet } from "react-router-dom";

import { useSession } from "../lib/authClient";
import { WorkspaceProvider } from "../lib/workspaceContext";

export const ProtectedRoute = () => {
  const { data, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!data?.session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <WorkspaceProvider>
      <Outlet />
    </WorkspaceProvider>
  );
};
