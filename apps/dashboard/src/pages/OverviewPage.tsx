const statCards = [
  { label: "Total Users", value: "—", color: "bg-blue-50 text-blue-700" },
  { label: "Pending KYC", value: "—", color: "bg-yellow-50 text-yellow-700" },
  { label: "Approved", value: "—", color: "bg-primary-50 text-primary-700" },
  { label: "Rejected", value: "—", color: "bg-red-50 text-red-700" },
];

export const OverviewPage = () => {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome to your UserCore dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <p className="text-sm font-medium text-gray-500">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.color}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Activity
        </h2>
        <p className="text-sm text-gray-500">No recent activity yet.</p>
      </div>
    </div>
  );
};
