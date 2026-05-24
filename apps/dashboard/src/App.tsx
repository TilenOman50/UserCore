import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CustomersPage } from "./pages/CustomersPage";
import { KycReviewDetailPage } from "./pages/KycReviewDetailPage";
import { KycReviewPage } from "./pages/KycReviewPage";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { ScenarioDetailPage } from "./pages/ScenarioDetailPage";
import { ScenariosPage } from "./pages/ScenariosPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WorkflowDetailPage } from "./pages/WorkflowDetailPage";
import { WorkflowsPage } from "./pages/WorkflowsPage";

export const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="workflows/:id" element={<WorkflowDetailPage />} />
          <Route path="kyc-review" element={<KycReviewPage />} />
          <Route
            path="kyc-review/:sessionId"
            element={<KycReviewDetailPage />}
          />
          <Route path="scenarios" element={<ScenariosPage />} />
          <Route path="scenarios/:id" element={<ScenarioDetailPage />} />
          <Route path="providers" element={<ProvidersPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
};
