import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { WorkflowDefinitionListPage } from "./pages/WorkflowDefinitionListPage.js";
import { WorkflowDefinitionDetailPage } from "./pages/WorkflowDefinitionDetailPage.js";
import { WorkflowRunListPage } from "./pages/WorkflowRunListPage.js";
import { WorkflowRunDetailPage } from "./pages/WorkflowRunDetailPage.js";

export const WorkflowRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/definitions" element={<WorkflowDefinitionListPage />} />
      <Route path="/definitions/:name" element={<WorkflowDefinitionDetailPage />} />
      <Route path="/runs" element={<WorkflowRunListPage />} />
      <Route path="/runs/:id" element={<WorkflowRunDetailPage />} />
      <Route path="/" element={<Navigate to="/runs" replace />} />
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
