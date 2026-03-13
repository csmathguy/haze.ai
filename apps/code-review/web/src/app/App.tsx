import { startTransition, useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import PsychologyAltOutlinedIcon from "@mui/icons-material/PsychologyAltOutlined";
import RuleFolderOutlinedIcon from "@mui/icons-material/RuleFolderOutlined";
import {
  Alert,
  Box,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { CodeReviewWorkspace, ReviewLaneId } from "@taxes/shared";

import { fetchCodeReviewWorkspace } from "./api.js";
import { LaneDetailPanel } from "./components/LaneDetailPanel.js";
import { LaneSelector } from "./components/LaneSelector.js";
import { ResearchPanel } from "./components/ResearchPanel.js";
import { RoadmapBoard } from "./components/RoadmapBoard.js";
import { groupRoadmapItems } from "./index.js";

export function App() {
  const { errorMessage, selectedLaneId, setSelectedLaneId, workspace } = useCodeReviewWorkspace();

  if (workspace === null) {
    return (
      <PageShell>
        {errorMessage === null ? <Alert severity="info">Loading review workspace...</Alert> : <Alert severity="error">{errorMessage}</Alert>}
      </PageShell>
    );
  }

  const activeLane = workspace.lanes.find((lane) => lane.id === selectedLaneId) ?? workspace.lanes[0];

  if (activeLane === undefined) {
    return null;
  }

  return (
    <PageShell>
      {errorMessage === null ? null : <Alert severity="warning">{errorMessage}</Alert>}
      <Hero workspace={workspace} />
      <Grid container spacing={2}>
        <Grid size={{ lg: 4, xs: 12 }}>
          <LaneSelector lanes={workspace.lanes} onSelect={setSelectedLaneId} selectedLaneId={activeLane.id} />
        </Grid>
        <Grid size={{ lg: 8, xs: 12 }}>
          <LaneDetailPanel lane={activeLane} />
        </Grid>
      </Grid>
      <RoadmapBoard groupedRoadmap={groupRoadmapItems(workspace.roadmap)} />
      <Grid container spacing={2}>
        <Grid size={{ md: 7, xs: 12 }}>
          <TrustPanel workspace={workspace} />
        </Grid>
        <Grid size={{ md: 5, xs: 12 }}>
          <ResearchPanel sources={workspace.researchSources} />
        </Grid>
      </Grid>
    </PageShell>
  );
}

function useCodeReviewWorkspace() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedLaneId, setSelectedLaneId] = useState<ReviewLaneId>("tests");
  const [workspace, setWorkspace] = useState<CodeReviewWorkspace | null>(null);

  useEffect(() => {
    void loadWorkspace();
  }, []);

  async function loadWorkspace(): Promise<void> {
    setErrorMessage(null);

    try {
      const nextWorkspace = await fetchCodeReviewWorkspace();

      startTransition(() => {
        setWorkspace(nextWorkspace);
        setSelectedLaneId(nextWorkspace.lanes[0]?.id ?? "tests");
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load the code review workspace.");
    }
  }

  return {
    errorMessage,
    selectedLaneId,
    setSelectedLaneId,
    workspace
  };
}

function PageShell({ children }: { readonly children: ReactNode }) {
  return (
    <Box
      sx={(theme) => ({
        background: `
          radial-gradient(circle at top left, ${alpha(theme.palette.secondary.main, 0.18)}, transparent 30%),
          linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.04)}, transparent 55%),
          ${theme.palette.background.default}
        `,
        minHeight: "100vh",
        py: 5
      })}
    >
      <Container maxWidth="xl">
        <Stack spacing={3}>{children}</Stack>
      </Container>
    </Box>
  );
}

function Hero({ workspace }: { readonly workspace: CodeReviewWorkspace }) {
  return (
    <Paper
      sx={(theme) => ({
        background: `linear-gradient(140deg, ${alpha(theme.palette.primary.main, 0.94)}, ${alpha(theme.palette.secondary.main, 0.84)})`,
        color: theme.palette.common.white,
        p: { md: 4, xs: 3 }
      })}
    >
      <Grid container spacing={3}>
        <Grid size={{ md: 8, xs: 12 }}>
          <HeroContent workspace={workspace} />
        </Grid>
        <Grid size={{ md: 4, xs: 12 }}>
          <HeroReviewSequence workspace={workspace} />
        </Grid>
      </Grid>
    </Paper>
  );
}

function TrustPanel({ workspace }: { readonly workspace: CodeReviewWorkspace }) {
  return (
    <Paper sx={{ p: 3 }} variant="outlined">
      <Stack spacing={2}>
        <Typography variant="h2">Trust contract</Typography>
        {workspace.principles.map((principle) => (
          <Stack key={principle.title} spacing={0.5}>
            <Typography variant="h3">{principle.title}</Typography>
            <Typography color="text.secondary" variant="body2">
              {principle.description}
            </Typography>
          </Stack>
        ))}
        <Stack spacing={1}>
          <Typography variant="subtitle2">Freshness strategy</Typography>
          {workspace.freshnessStrategy.map((item) => (
            <Stack alignItems="flex-start" direction="row" key={item} spacing={1}>
              <ErrorOutlineOutlinedIcon color="info" fontSize="small" sx={{ mt: 0.2 }} />
              <Typography variant="body2">{item}</Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}

function HeroContent({ workspace }: { readonly workspace: CodeReviewWorkspace }) {
  return (
    <Stack spacing={2}>
      <Typography variant="h1">{workspace.title}</Typography>
      <Typography maxWidth={860} variant="body1">
        {workspace.purpose}
      </Typography>
      <Typography
        maxWidth={820}
        sx={(theme) => ({
          color: alpha(theme.palette.common.white, 0.84)
        })}
        variant="body2"
      >
        {workspace.trustStatement}
      </Typography>
      <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
        <HeroChip icon={<FactCheckOutlinedIcon />} label={`${workspace.lanes.length.toString()} review lanes`} />
        <HeroChip icon={<RuleFolderOutlinedIcon />} label={`${workspace.roadmap.length.toString()} roadmap slices`} />
        <HeroChip icon={<PsychologyAltOutlinedIcon />} label="Human trust remains the final gate" />
      </Stack>
    </Stack>
  );
}

function HeroReviewSequence({ workspace }: { readonly workspace: CodeReviewWorkspace }) {
  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.common.white, 0.12),
        borderColor: alpha(theme.palette.common.white, 0.18),
        color: theme.palette.common.white,
        p: 2.5
      })}
      variant="outlined"
    >
      <Stack spacing={1.25}>
        <Typography
          sx={(theme) => ({
            color: alpha(theme.palette.common.white, 0.8)
          })}
          variant="subtitle2"
        >
          Review sequence
        </Typography>
        {workspace.lanes.slice(0, 4).map((lane, index) => (
          <Stack alignItems="flex-start" direction="row" key={lane.id} spacing={1.25}>
            <Chip
              label={(index + 1).toString()}
              size="small"
              sx={(theme) => ({
                backgroundColor: alpha(theme.palette.common.white, 0.18),
                color: theme.palette.common.white,
                minWidth: 32
              })}
            />
            <Stack spacing={0.25}>
              <Typography variant="body2">{lane.title}</Typography>
              <Typography
                sx={(theme) => ({
                  color: alpha(theme.palette.common.white, 0.78)
                })}
                variant="body2"
              >
                {lane.summary}
              </Typography>
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

function HeroChip({ icon, label }: { readonly icon: ReactElement; readonly label: string }) {
  return (
    <Chip
      icon={icon}
      label={label}
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.common.white, 0.14),
        border: `1px solid ${alpha(theme.palette.common.white, 0.18)}`,
        color: theme.palette.common.white
      })}
      variant="outlined"
    />
  );
}
