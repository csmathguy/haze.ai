import { Alert } from "@mui/material";

import type { ReviewBannerState } from "../index.js";

interface WorkspaceAlertsProps {
  readonly banner: ReviewBannerState | null;
  readonly errorMessage: string | null;
  readonly uploadMessage: string | null;
}

export function WorkspaceAlerts({ banner, errorMessage, uploadMessage }: WorkspaceAlertsProps) {
  return (
    <>
      {banner !== null ? <Alert severity={banner.emphasis}>{banner.message}</Alert> : null}
      {uploadMessage !== null ? <Alert severity="success">{uploadMessage}</Alert> : null}
      {errorMessage !== null ? <Alert severity="error">{errorMessage}</Alert> : null}
    </>
  );
}
