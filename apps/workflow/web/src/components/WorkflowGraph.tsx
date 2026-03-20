import React, { useCallback, useState } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Box,
  Drawer as MuiDrawer,
  Typography,
  Divider,
  Stack,
  Chip,
  Button
} from "@mui/material";
import {
  Code as CodeIcon,
  Psychology as AgentIcon,
  CheckCircle as ApprovalIcon,
  Schedule as WaitIcon,
  Help as HelpIcon
} from "@mui/icons-material";
import * as dagre from "dagre";

import type { WorkflowDefinition } from "../app/api.js";

interface WorkflowStep {
  id: string;
  type: "deterministic" | "agent" | "approval" | "condition" | "wait";
  label: string;
  scriptPath?: string;
  agentName?: string;
  model?: string;
  skills?: string[];
  timeout?: number;
  retryPolicy?: Record<string, unknown>;
  branches?: Record<string, string>;
  nextStep?: string;
}

interface WorkflowGraphProps {
  definition: WorkflowDefinition;
}

const getNodeColor = (type: string): string => {
  switch (type) {
    case "deterministic":
      return "primary.main";
    case "agent":
      return "secondary.main";
    case "approval":
      return "warning.main";
    case "condition":
      return "warning.dark";
    case "wait":
      return "success.main";
    default:
      return "text.disabled";
  }
};

const getNodeIcon = (type: string) => {
  switch (type) {
    case "deterministic":
      return <CodeIcon fontSize="small" />;
    case "agent":
      return <AgentIcon fontSize="small" />;
    case "approval":
      return <ApprovalIcon fontSize="small" />;
    case "condition":
      return <HelpIcon fontSize="small" />;
    case "wait":
      return <WaitIcon fontSize="small" />;
    default:
      return null;
  }
};

const CustomNode: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const step = data as unknown as WorkflowStep;

  return (
    <Box sx={{ bgcolor: getNodeColor(step.type), borderRadius: 1, minWidth: 120, border: "2px solid white", boxShadow: 1 }}>
      <Box sx={{ padding: 1.5, textAlign: "center", color: "white" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, mb: 0.5 }}>
          {getNodeIcon(step.type)}
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {step.type}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {step.label}
        </Typography>
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
      </Box>
    </Box>
  );
};

const nodeTypes: NodeTypes = {
  custom: CustomNode
};

const StepAgentSection: React.FC<{ step: WorkflowStep }> = ({ step }) => (
  <>
    <Box>
      <Typography variant="overline" color="textSecondary">
        Agent Name
      </Typography>
      <Typography variant="body2">{step.agentName}</Typography>
    </Box>
    {step.model && (
      <Box>
        <Typography variant="overline" color="textSecondary">
          Model
        </Typography>
        <Typography variant="body2">{step.model}</Typography>
      </Box>
    )}
    {step.skills && step.skills.length > 0 && (
      <Box>
        <Typography variant="overline" color="textSecondary">
          Skills
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {step.skills.map((skill) => (
            <Chip key={skill} label={skill} size="small" variant="outlined" />
          ))}
        </Box>
      </Box>
    )}
  </>
);

const StepBranchesSection: React.FC<{ branches: Record<string, string> }> = ({ branches }) => (
  <Box>
    <Typography variant="overline" color="textSecondary">
      Condition Branches
    </Typography>
    <Stack spacing={1}>
      {Object.entries(branches).map(([condition, targetId]) => (
        <Box key={condition} sx={{ p: 1, bgcolor: "action.hover", borderRadius: 1 }}>
          <Typography variant="caption" color="textSecondary">
            {condition} →
          </Typography>
          <Typography variant="body2">{targetId}</Typography>
        </Box>
      ))}
    </Stack>
  </Box>
);

const StepDetailDrawer: React.FC<{ step: WorkflowStep | null; open: boolean; onClose: () => void }> = ({
  step,
  open,
  onClose
}) => (
  <MuiDrawer anchor="right" open={open} onClose={onClose} sx={{ minWidth: 350 }}>
    <Box sx={{ width: 350, p: 3, overflow: "auto" }}>
      {step && (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <Typography variant="h6">Step Details</Typography>
            <Button size="small" onClick={onClose}>Close</Button>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2}>
            <Box>
              <Typography variant="overline" color="textSecondary">Label</Typography>
              <Typography variant="body2">{step.label}</Typography>
            </Box>
            <Box>
              <Typography variant="overline" color="textSecondary">Type</Typography>
              <Chip label={step.type} size="small" />
            </Box>
            {step.scriptPath && (
              <Box>
                <Typography variant="overline" color="textSecondary">Script Path</Typography>
                <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}>
                  {step.scriptPath}
                </Typography>
              </Box>
            )}
            {step.agentName && <StepAgentSection step={step} />}
            {step.timeout && (
              <Box>
                <Typography variant="overline" color="textSecondary">Timeout (ms)</Typography>
                <Typography variant="body2">{step.timeout}</Typography>
              </Box>
            )}
            {step.retryPolicy && (
              <Box>
                <Typography variant="overline" color="textSecondary">Retry Policy</Typography>
                <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.75rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {JSON.stringify(step.retryPolicy, null, 2)}
                </Typography>
              </Box>
            )}
            {step.branches && Object.keys(step.branches).length > 0 && (
              <StepBranchesSection branches={step.branches} />
            )}
          </Stack>
        </>
      )}
    </Box>
  </MuiDrawer>
);

function buildGraphFromDefinition(definitionJson: string): { nodes: Node[]; edges: Edge[] } {
  const definitionData = JSON.parse(definitionJson) as Record<string, unknown>;
  const steps = (definitionData.steps as WorkflowStep[] | undefined) ?? [];

  const newNodes: Node[] = steps.map((step) => ({
    id: step.id,
    data: step as unknown as Record<string, unknown>,
    position: { x: 0, y: 0 },
    type: "custom"
  }));

  const newEdges: Edge[] = [];
  steps.forEach((step) => {
    if (step.branches) {
      Object.entries(step.branches).forEach(([condition, targetId]) => {
        newEdges.push({ id: `${step.id}-${targetId}`, source: step.id, target: targetId, label: condition, animated: false });
      });
    } else if (step.nextStep) {
      newEdges.push({ id: `${step.id}-${step.nextStep}`, source: step.id, target: step.nextStep, animated: false });
    }
  });

  return { nodes: applyDagreLayout(newNodes, newEdges), edges: newEdges };
}

export const WorkflowGraph: React.FC<WorkflowGraphProps> = ({ definition }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  React.useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildGraphFromDefinition(definition.definitionJson);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [definition, setNodes, setEdges]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedStep(node.data as unknown as WorkflowStep);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedStep(null);
  };

  return (
    <Box sx={{ display: "flex", height: "100%", width: "100%" }}>
      <Box sx={{ flex: 1, position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </Box>
      <StepDetailDrawer step={selectedStep} open={drawerOpen} onClose={closeDrawer} />
    </Box>
  );
};

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB" });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => { g.setNode(node.id, { width: 150, height: 100 }); });
  edges.forEach((edge) => { g.setEdge(edge.source, edge.target); });
  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - 75, y: pos.y - 50 } };
  });
}
