import { useId } from "react";
import { Button, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";

import { PanelCard } from "./PanelCard.js";

interface DocumentUploadPanelProps {
  readonly disabled: boolean;
  readonly onUpload: (file: File) => Promise<void>;
}

export function DocumentUploadPanel({ disabled, onUpload }: DocumentUploadPanelProps) {
  const inputId = useId();

  return (
    <PanelCard
      sx={(theme) => ({
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.secondary.main, 0.08)})`,
        border: `1px dashed ${alpha(theme.palette.primary.main, 0.3)}`
      })}
    >
      <Stack spacing={2}>
        <Typography variant="h5">Add tax documents</Typography>
        <Typography color="text.secondary" variant="body2">
          Upload PDFs, CSV exports, or broker statements. Files stay on the local machine and are staged for extraction and review.
        </Typography>
        <div>
          <input
            hidden
            id={inputId}
            onChange={(event) => {
              const file = event.target.files?.[0];

              event.target.value = "";

              if (file !== undefined) {
                void onUpload(file);
              }
            }}
            type="file"
          />
          <Button
            component="label"
            disabled={disabled}
            htmlFor={inputId}
            startIcon={<UploadFileOutlinedIcon />}
            variant="contained"
          >
            Upload document
          </Button>
        </div>
        <Typography color="text.secondary" variant="caption">
          Current scaffold limit: 25 MB per file. Extraction logic will be layered in after the upload and review pipeline is stable.
        </Typography>
      </Stack>
    </PanelCard>
  );
}
