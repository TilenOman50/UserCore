import type { ReactNode } from "react";

export const ConfirmDialog = (props: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) => {
  const {
    open,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger = false,
    onConfirm,
    onCancel,
    busy = false,
  } = props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 max-w-md w-full p-6 shadow-xl">
        <h2
          className={`text-lg font-semibold mb-1 ${
            danger ? "text-red-700" : "text-gray-900"
          }`}
        >
          {title}
        </h2>
        <div className="text-sm text-gray-600">{message}</div>

        <div className="flex gap-2 justify-end pt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${
              danger
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-primary-200 hover:bg-primary-300 text-primary-800"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
