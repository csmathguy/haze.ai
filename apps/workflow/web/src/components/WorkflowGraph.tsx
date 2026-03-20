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

const CustomNode: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const step = data as unknown as WorkflowStep;

  const getNodeColor = (): string => {
    switch (step.type) {
      case "deterministic":
        return "#1976d2";
      case "agent":
        return "#9c27b0";
      case "approval":
        return "#fbc02d";
      case "condition":
        return "#ff9800";
      case "wait":
        return "#4caf50";
      default:
        return "#757575";
    }
  };

  const getNodeIcon = () => {
    switch (step.type) {
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

  return (
    <Box
      sx={{
        padding: 1.5,
        borderRadius: 1,
        backgroundColor: getNodeColor(),
        color: "white",
        minWidth: 120,
        textAlign: "center",
        border: "2px solid white",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, mb: 0.5 }}>
        {getNodeIcon()}
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
  );
};

const nodeTypes: NodeTypes = {
  custom: CustomNode
};

export const WorkflowGraph: React.FC<WorkflowGraphProps> = ({ definition }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  React.useEffect(() => {
    const definitionData = JSON.parse(definition.definitionJson) as Record<string, unknown>;
    const steps = (definitionData.steps as WorkflowStep[]) || [];

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
          newEdges.push({
            id: `${step.id}-${targetId}`,
            source: step.id,
            target: targetId,
            label: condition,
            animated: false
          });
        });
      } else if (step.nextStep) {
        newEdges.push({
          id: `${step.id}-${step.nextStep}`,
          source: step.id,
          target: step.nextStep,
          animated: false
        });
      }
    });

    // Apply Dagre layout
    const layoutNodes = applyDagreLayout(newNodes, newEdges);
    setNodes(layoutNodes);
    setEdges(newEdges);
  }, [definition, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const step = node.data as unknown as WorkflowStep;
      setSelectedStep(step);
      setDrawerOpen(true);
    },
    []
  );

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

      <MuiDrawer anchor="right" open={drawerOpen} onClose={closeDrawer} sx={{ minWidth: 350 }}>
        <Box sx={{ width: 350, p: 3, overflow: "auto" }}>
          {selectedStep && (
            <>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <Typography variant="h6">Step Details</Typography>
                <Button size="small" onClick={closeDrawer}>
                  Close
                </Button>
              </Box>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={2}>
                <Box>
                  <Typography variant="overline" color="textSecondary">
                    Label
                  </Typography>
                  <Typography variant="body2">{selectedStep.label}</Typography>
                </Box>

                <Box>
                  <Typography variant="overline" color="textSecondary">
                    Type
                  </Typography>
                  <Chip label={selectedStep.type} size="small" />
                </Box>

                {selectedStep.scriptPath && (
                  <Box>
                    <Typography variant="overline" color="textSecondary">
                      Script Path
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}>
                      {selectedStep.scriptPath}
                    </Typography>
                  </Box>
                )}

                {selectedStep.agentName && (
                  <>
                    <Box>
                      <Typography variant="overline" color="textSecondary">
                        Agent Name
                      </Typography>
                      <Typography variant="body2">{selectedStep.agentName}</Typography>
                    </Box>
                    {selectedStep.model && (
                      <Box>
                        <Typography variant="overline" color="textSecondary">
                          Model
                        </Typography>
                        <Typography variant="body2">{selectedStep.model}</Typography>
                      </Box>
                    )}
                    {selectedStep.skills && selectedStep.skills.length > 0 && (
                      <Box>
                        <Typography variant="overline" color="textSecondary">
                          Skills
                        </Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                          {selectedStep.skills.map((skill) => (
                            <Chip key={skill} label={skill} size="small" variant="outlined" />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </>
                )}

                {selectedStep.timeout && (
                  <Box>
                    <Typography variant="overline" color="textSecondary">
                      Timeout (ms)
                    </Typography>
                    <Typography variant="body2">{selectedStep.timeout}</Typography>
                  </Box>
                )}

                {selectedStep.retryPolicy && (
                  <Box>
                    <Typography variant="overline" color="textSecondary">
                      Retry Policy
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.75rem",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word"
                      }}
                    >
                      {JSON.stringify(selectedStep.retryPolicy, null, 2)}
                    </Typography>
                  </Box>
                )}

                {selectedStep.branches && Object.keys(selectedStep.branches).length > 0 && (
                  <Box>
                    <Typography variant="overline" color="textSecondary">
                      Condition Branches
                    </Typography>
                    <Stack spacing={1}>
                      {Object.entries(selectedStep.branches).map(([condition, targetId]) => (
                        <Box key={condition} sx={{ p: 1, bgcolor: "action.hover", borderRadius: 1 }}>
                          <Typography variant="caption" color="textSecondary">
                            {condition} →
                          </Typography>
                          <Typography variant="body2">{targetId}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </>
          )}
        </Box>
      </MuiDrawer>
    </Box>
  );
};

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB" });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 150, height: 100 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - 75, y: pos.y - 50 }
    };
  });
}
