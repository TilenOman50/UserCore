import { t } from "../lib/i18n";

export const SuccessStep = () => {
  return (
    <div className="flex flex-col h-full items-center text-center">
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary-700"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mt-5">
          {t("success.title")}
        </h2>
        <p className="text-sm text-gray-500 mt-2 max-w-xs">
          {t("success.subtitle")}
        </p>
      </div>

      <div className="w-full bg-primary-50 border border-primary-100 rounded-xl p-4 text-left">
        <p className="text-xs font-semibold text-primary-800 mb-2 uppercase tracking-wide">
          {t("success.nextHeading")}
        </p>
        <ul className="text-xs text-primary-700/90 space-y-1">
          <li>· {t("success.next1")}</li>
          <li>· {t("success.next2")}</li>
          <li>· {t("success.next3")}</li>
        </ul>
      </div>
    </div>
  );
};
