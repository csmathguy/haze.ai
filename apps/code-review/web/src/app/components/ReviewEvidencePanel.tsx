import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { Button, Chip, Divider, Stack, Typography } from "@mui/material";

import type { ReviewEvidencePresentation, ReviewEvidenceSummary } from "../review-evidence.js";

interface ReviewEvidencePanelProps {
  readonly presentation: ReviewEvidencePresentation;
}

export function ReviewEvidencePanel({ presentation }: ReviewEvidencePanelProps) {
  return (
    <Stack spacing={2} sx={{ p: 0.5 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">Proof at a glance</Typography>
        <Stack direction={{ sm: "row", xs: "column" }} flexWrap="wrap" gap={1}>
          {presentation.summaries.map((summary) => (
            <EvidenceSummaryChip key={summary.label} summary={summary} />
          ))}
        </Stack>
      </Stack>
      {presentation.sections.map((section, index) => (
        <Stack key={section.title} spacing={1.25}>
          {index === 0 ? null : <Divider />}
          <Typography variant="subtitle2">{section.title}</Typography>
          {section.items.map((item) => (
            <Typography color="text.secondary" key={`${section.title}-${item}`} variant="body2">
              {item}
            </Typography>
          ))}
          {section.links?.map((link) => (
            <Button
              component="a"
              endIcon={<OpenInNewOutlinedIcon />}
              href={link.href}
              key={`${section.title}-${link.href}`}
              rel="noreferrer"
              size="small"
              sx={{ alignSelf: "flex-start" }}
              target="_blank"
              variant="outlined"
            >
              {link.label}
            </Button>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}

function EvidenceSummaryChip({ summary }: { readonly summary: ReviewEvidenceSummary }) {
  return (
    <Chip
      color={getChipColor(summary.status)}
      label={`${summary.label}: ${summary.detail}`}
      sx={{ justifyContent: "flex-start", maxWidth: "100%", px: 0.5 }}
      variant={summary.status === "available" ? "filled" : "outlined"}
    />
  );
}

function getChipColor(status: ReviewEvidenceSummary["status"]): "default" | "error" | "info" | "success" | "warning" {
  switch (status) {
    case "available":
      return "success";
    case "missing":
      return "warning";
    case "partial":
      return "info";
  }
}
