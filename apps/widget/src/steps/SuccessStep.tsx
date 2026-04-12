export const SuccessStep = () => {
  return (
    <div className="text-center py-8 space-y-4">
      <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
        <span className="text-3xl">✅</span>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Verification Submitted</h2>
        <p className="text-sm text-gray-500 mt-1">
          Your information has been submitted for review. You will be notified once the review is complete.
        </p>
      </div>
      <div className="bg-primary-50 rounded-lg p-4 text-left">
        <p className="text-xs text-primary-700 font-medium mb-1">What happens next?</p>
        <ul className="text-xs text-primary-600 space-y-1">
          <li>• Our team will review your submission</li>
          <li>• You'll receive an email with the decision</li>
          <li>• Typically reviewed within 1-2 business days</li>
        </ul>
      </div>
    </div>
  );
};
