import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { ReviewEvidencePresentation } from "../review-evidence.js";

interface ReviewEvidencePanelProps {
  readonly presentation: ReviewEvidencePresentation;
}

export function ReviewEvidencePanel({ presentation }: ReviewEvidencePanelProps) {
  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.background.default, 0.76),
        p: 2.5
      })}
      variant="outlined"
    >
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Review Evidence</Typography>
          <Typography color="text.secondary" variant="body2">
            Use this stage to inspect validation commands, reported checks, and workflow evidence before the human review decision.
          </Typography>
        </Stack>
        {presentation.sections.map((section) => (
          <Stack key={section.title} spacing={1}>
            <Typography variant="subtitle2">{section.title}</Typography>
            {section.items.map((item) => (
              <Typography key={`${section.title}-${item}`} variant="body2">
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
                target="_blank"
                variant="outlined"
              >
                {link.label}
              </Button>
            ))}
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
