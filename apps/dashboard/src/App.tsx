import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SettingsLayout } from "./components/SettingsLayout";
import { CustomersPage } from "./pages/CustomersPage";
import { KycReviewDetailPage } from "./pages/KycReviewDetailPage";
import { KycReviewPage } from "./pages/KycReviewPage";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { ScenarioDetailPage } from "./pages/ScenarioDetailPage";
import { ScenariosPage } from "./pages/ScenariosPage";
import { ApiKeysPage } from "./pages/settings/ApiKeysPage";
import { DocsPage } from "./pages/settings/DocsPage";
import { GeneralSettingsPage } from "./pages/settings/GeneralSettingsPage";
import { MembersSettingsPage } from "./pages/settings/MembersSettingsPage";
import { PlanSettingsPage } from "./pages/settings/PlanSettingsPage";
import { ProfilePage } from "./pages/settings/ProfilePage";
import { WorkflowDetailPage } from "./pages/WorkflowDetailPage";
import { WorkflowsPage } from "./pages/WorkflowsPage";

// Config pages moved under /settings — preserve old top-level URLs (bookmarks,
// stale links) by prefixing the current path with /settings.
const SettingsRedirect = () => {
  const loc = useLocation();
  return <Navigate to={`/settings${loc.pathname}${loc.search}`} replace />;
};

export const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="kyc-review" element={<KycReviewPage />} />
          <Route
            path="kyc-review/:sessionId"
            element={<KycReviewDetailPage />}
          />

          {/* Settings — vertical sub-nav hosting config + workspace admin */}
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="workflows" replace />} />
            <Route path="workflows" element={<WorkflowsPage />} />
            <Route path="scenarios" element={<ScenariosPage />} />
            <Route path="providers" element={<ProvidersPage />} />
            <Route path="api-keys" element={<ApiKeysPage />} />
            <Route path="general" element={<GeneralSettingsPage />} />
            <Route path="members" element={<MembersSettingsPage />} />
            <Route path="plan" element={<PlanSettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="docs" element={<DocsPage />} />
          </Route>

          {/* Full-bleed editors — live under /settings but outside the sub-nav */}
          <Route
            path="settings/workflows/:id"
            element={<WorkflowDetailPage />}
          />
          <Route
            path="settings/scenarios/:id"
            element={<ScenarioDetailPage />}
          />

          {/* Legacy redirects from the old top-level routes */}
          <Route path="workflows" element={<SettingsRedirect />} />
          <Route path="workflows/:id" element={<SettingsRedirect />} />
          <Route path="scenarios" element={<SettingsRedirect />} />
          <Route path="scenarios/:id" element={<SettingsRedirect />} />
          <Route path="providers" element={<SettingsRedirect />} />
        </Route>
      </Route>
    </Routes>
  );
};
