import { Box, Paper, Typography } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const AuditPanel = styled(Paper)(({ theme }) => ({
  border: `1px solid var(--mui-palette-divider)`,
  borderRadius: Number(theme.shape.borderRadius) * 1.15,
  padding: theme.spacing(2.5)
}));

export const CodeBlock = styled("pre")(({ theme }) => ({
  backgroundColor: alpha(theme.palette.common.black, 0.04),
  border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
  borderRadius: Number(theme.shape.borderRadius) * 0.9,
  fontFamily: theme.typography.subtitle2.fontFamily,
  fontSize: "0.78rem",
  margin: 0,
  overflowX: "auto",
  padding: theme.spacing(1.5),
  whiteSpace: "pre-wrap"
}));

export function DetailGrid({ items }: { readonly items: { label: string; value: string }[] }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 1.5
      }}
    >
      {items.map((item) => (
        <Paper
          elevation={0}
          key={item.label}
          sx={{
            border: "1px solid var(--mui-palette-divider)",
            borderRadius: "calc(var(--mui-shape-borderRadius) * 0.95)",
            flex: "1 1 220px",
            p: 1.5
          }}
        >
          <Typography color="text.secondary" variant="subtitle2">
            {item.label}
          </Typography>
          <Typography sx={{ mt: 0.75, wordBreak: "break-word" }} variant="body2">
            {item.value}
          </Typography>
        </Paper>
      ))}
    </Box>
  );
}
