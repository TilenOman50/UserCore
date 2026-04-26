import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type DropdownOption = {
  value: string;
  label: string;
};

type Position = { top: number; left: number; width: number };

export const Dropdown = (props: {
  value: string;
  options: ReadonlyArray<DropdownOption>;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: "default" | "sm";
}) => {
  const {
    value,
    options,
    onChange,
    placeholder,
    className = "",
    disabled = false,
    size = "default",
  } = props;

  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Recompute the popover position when it opens or the window changes.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const update = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  // Close on click outside (button + popover both opt out).
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder ?? "Select…";

  const sizeClasses = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm";

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 ${sizeClasses} border border-gray-300 rounded-lg bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:border-gray-300`}
      >
        <span className={selected ? "" : "text-gray-400"}>{displayLabel}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4 text-gray-400 flex-shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              minWidth: position.width,
            }}
            className="bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-auto"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  opt.value === value
                    ? "bg-primary-50 text-primary-800"
                    : "text-gray-700"
                }`}
              >
                <span>{opt.label}</span>
                {opt.value === value && (
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
          </div>,
          document.body,
        )}
    </div>
  );
};
