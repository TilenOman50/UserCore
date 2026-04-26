import { Link, Outlet, useLocation } from "react-router-dom";

const navItems = [
  { path: "/", label: "Overview" },
  { path: "/users", label: "Users" },
  { path: "/kyc-review", label: "KYC Review" },
  { path: "/scenarios", label: "Scenarios" },
  { path: "/settings", label: "Settings" },
];

export const Layout = () => {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-200 flex items-center justify-center">
              <span className="text-sm font-bold text-primary-700">UC</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">
              UserCore
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary-200 text-primary-800"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};
