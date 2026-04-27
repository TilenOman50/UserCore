import { Check, CloudUpload, Loader2 } from "lucide-react";

export type SaveStatus = "saved" | "pending" | "saving";

export const SaveIndicator = ({ status }: { status: SaveStatus }) => {
  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <Check size={12} className="text-primary-600" />
        Saved
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <Loader2 size={12} className="animate-spin" />
        Saving…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
      <CloudUpload size={12} />
      Pending…
    </span>
  );
};
