import { useEffect, useRef, useState } from "react";

import { useSwitchWorkspace } from "../../lib/hooks/useWorkspaceMutations";
import { useWorkspace } from "../../lib/workspaceContext";
import { NewWorkspaceModal } from "./NewWorkspaceModal";

export const WorkspaceSwitcher = () => {
  const { workspace, workspaces, organization, role } = useWorkspace();
  const switchWorkspace = useSwitchWorkspace();

  const canCreateWorkspace = role === "owner" || role === "admin";

  const [open, setOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleSwitch = async (workspaceId: string) => {
    setOpen(false);
    if (workspaceId === workspace?.id) return;
    await switchWorkspace.mutateAsync(workspaceId);
  };

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 group"
          title="Switch workspace"
        >
          <div className="w-8 h-8 rounded-lg bg-primary-200 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-primary-700">UC</span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-semibold text-gray-900 truncate leading-tight">
              {workspace?.name ?? "—"}
            </div>
            <div className="text-xs text-gray-500 leading-tight truncate">
              {organization.name}
            </div>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
            <div className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
              Workspaces in {organization.name}
            </div>
            {workspaces.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => handleSwitch(w.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 ${
                  w.isActive ? "bg-primary-50" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {w.name}
                  </div>
                </div>
                {w.isActive && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4 text-primary-700 flex-shrink-0"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
            {canCreateWorkspace && (
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setNewOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-800 hover:bg-gray-50"
                >
                  <span className="text-base leading-none">+</span> New
                  workspace
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <NewWorkspaceModal open={newOpen} onClose={() => setNewOpen(false)} />
    </>
  );
};
