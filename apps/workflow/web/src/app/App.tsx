import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { WorkflowDefinitionListPage } from "./pages/WorkflowDefinitionListPage.js";
import { WorkflowDefinitionDetailPage } from "./pages/WorkflowDefinitionDetailPage.js";
import { WorkflowRunDetailPage } from "./pages/WorkflowRunDetailPage.js";
import { AnalyticsPage } from "./pages/AnalyticsPage.js";
import { FleetDashboard } from "./pages/FleetDashboard.js";

export const WorkflowRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/fleet" element={<FleetDashboard />} />
      <Route path="/definitions" element={<WorkflowDefinitionListPage />} />
      <Route path="/definitions/:name" element={<WorkflowDefinitionDetailPage />} />
      <Route path="/runs" element={<Navigate to="/fleet" replace />} />
      <Route path="/runs/:id" element={<WorkflowRunDetailPage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
      <Route path="/" element={<Navigate to="/fleet" replace />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <Router>
      <WorkflowRoutes />
    </Router>
  );
};
