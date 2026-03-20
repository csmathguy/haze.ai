import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { WorkflowDefinitionListPage } from "./pages/WorkflowDefinitionListPage.js";
import { WorkflowDefinitionDetailPage } from "./pages/WorkflowDefinitionDetailPage.js";

export const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/definitions" element={<WorkflowDefinitionListPage />} />
        <Route path="/definitions/:name" element={<WorkflowDefinitionDetailPage />} />
        <Route path="/" element={<Navigate to="/definitions" replace />} />
      </Routes>
    </Router>
  );
};
