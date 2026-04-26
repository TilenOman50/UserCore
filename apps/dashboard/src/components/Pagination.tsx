export const Pagination = (props: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) => {
  const { page, totalPages, total, onPageChange } = props;

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm text-gray-600">
      <div>
        Page <strong className="text-gray-900">{page}</strong> of{" "}
        <strong className="text-gray-900">{totalPages}</strong> · {total} total
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
};
