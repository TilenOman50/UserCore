import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CustomersPage } from "./pages/CustomersPage";
import { KycReviewPage } from "./pages/KycReviewPage";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ScenariosPage } from "./pages/ScenariosPage";
import { SettingsPage } from "./pages/SettingsPage";

export const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="kyc-review" element={<KycReviewPage />} />
          <Route path="scenarios" element={<ScenariosPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
};
