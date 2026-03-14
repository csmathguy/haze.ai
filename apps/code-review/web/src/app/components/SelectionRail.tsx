import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

export interface SelectionRailItem {
  readonly subtitle: string;
  readonly title: string;
}

interface SelectionRailProps {
  readonly activeTitle: string | undefined;
  readonly items: SelectionRailItem[];
  readonly onSelect: (title: string) => void;
  readonly title: string;
}

export function SelectionRail({ activeTitle, items, onSelect, title }: SelectionRailProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{title}</Typography>
      <Box sx={{ display: "grid", gap: 1.25, gridAutoColumns: { md: "minmax(240px, 1fr)", xs: "minmax(220px, 1fr)" }, gridAutoFlow: "column", overflowX: "auto", pb: 0.5 }}>
        {items.map((item) => (
          <SelectionRailCard activeTitle={activeTitle} item={item} key={item.title} onSelect={onSelect} />
        ))}
      </Box>
    </Stack>
  );
}

function SelectionRailCard({
  activeTitle,
  item,
  onSelect
}: {
  readonly activeTitle: string | undefined;
  readonly item: SelectionRailItem;
  readonly onSelect: (title: string) => void;
}) {
  const isActive = item.title === activeTitle;

  return (
    <Paper
      onClick={() => {
        onSelect(item.title);
      }}
      sx={(theme) => ({
        backgroundColor: isActive ? alpha(theme.palette.secondary.main, 0.1) : theme.palette.background.paper,
        borderColor: isActive ? alpha(theme.palette.secondary.main, 0.45) : alpha(theme.palette.divider, 0.8),
        cursor: "pointer",
        minHeight: 106,
        p: 1.5
      })}
      variant="outlined"
    >
      <Stack spacing={1}>
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
          <Typography sx={{ wordBreak: "break-word" }} variant="body2">
            {item.title}
          </Typography>
          {isActive ? <Chip color="secondary" label="Active" size="small" variant="filled" /> : null}
        </Stack>
        <Typography color="text.secondary" variant="body2">
          {item.subtitle}
        </Typography>
      </Stack>
    </Paper>
  );
}
