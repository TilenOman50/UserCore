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
          Verification submitted
        </h2>
        <p className="text-sm text-gray-500 mt-2 max-w-xs">
          Your information is on its way to our review team. You'll be notified
          once a decision is made.
        </p>
      </div>

      <div className="w-full bg-primary-50 border border-primary-100 rounded-xl p-4 text-left">
        <p className="text-xs font-semibold text-primary-800 mb-2 uppercase tracking-wide">
          What happens next
        </p>
        <ul className="text-xs text-primary-700/90 space-y-1">
          <li>· Our team reviews your submission</li>
          <li>· You receive an email with the decision</li>
          <li>· Typically reviewed within 1–2 business days</li>
        </ul>
      </div>
    </div>
  );
};
