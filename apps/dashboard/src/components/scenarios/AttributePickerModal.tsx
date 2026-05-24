import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import {
  SCENARIO_ATTRIBUTES,
  type AttributeDefinition,
} from "@usercore/shared-types";

export const TYPE_BADGE_COLORS: Record<AttributeDefinition["type"], string> = {
  string: "bg-blue-100 text-blue-700",
  number: "bg-purple-100 text-purple-700",
  boolean: "bg-amber-100 text-amber-700",
  date: "bg-pink-100 text-pink-700",
  enum: "bg-emerald-100 text-emerald-700",
  "multi-enum": "bg-teal-100 text-teal-700",
};

const CATEGORY_DOT_COLORS: Record<string, string> = {
  Identity: "bg-emerald-400",
  Contact: "bg-sky-400",
  "AML screening": "bg-amber-400",
  "Fraud detection": "bg-rose-400",
};

const ALL_CATEGORIES = Array.from(
  new Set(SCENARIO_ATTRIBUTES.map((a) => a.category)),
);

type Props = {
  selected: string;
  onPick: (attributeKey: string) => void;
  onClose: () => void;
};

export const AttributePickerModal = ({ selected, onPick, onClose }: Props) => {
  const [activeTab, setActiveTab] = useState<string>("All");
  const [search, setSearch] = useState("");

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SCENARIO_ATTRIBUTES.filter((a) => {
      if (activeTab !== "All" && a.category !== activeTab) return false;
      if (!q) return true;
      return (
        a.label.toLowerCase().includes(q) || a.key.toLowerCase().includes(q)
      );
    });
  }, [activeTab, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, AttributeDefinition[]>();
    for (const attr of filtered) {
      const list = map.get(attr.category) ?? [];
      list.push(attr);
      map.set(attr.category, list);
    }
    return map;
  }, [filtered]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Select an attribute
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Pick a captured customer attribute to match against.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="px-6 pt-4 pb-3 border-b border-gray-100 space-y-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search attributes…"
              autoFocus
              className="w-full h-9 pl-9 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 bg-gray-50 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["All", ...ALL_CATEGORIES] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-primary-200 text-primary-800"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {grouped.size === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No attributes match{" "}
              <span className="font-medium text-gray-700">"{search}"</span>.
            </div>
          ) : (
            [...grouped.entries()].map(([category, attrs]) => (
              <section key={category}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      CATEGORY_DOT_COLORS[category] ?? "bg-gray-400"
                    }`}
                  />
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {category}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {attrs.map((attr) => (
                    <button
                      key={attr.key}
                      type="button"
                      onClick={() => {
                        onPick(attr.key);
                        onClose();
                      }}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        selected === attr.key
                          ? "border-primary-400 bg-primary-50 text-primary-800"
                          : "border-gray-200 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50"
                      }`}
                    >
                      <span>{attr.label}</span>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${TYPE_BADGE_COLORS[attr.type]}`}
                      >
                        {attr.type}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
