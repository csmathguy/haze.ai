import { useState } from "react";
import { Alert, Button, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { SaveBitcoinBasisProfileInput, SaveBitcoinLotSelectionInput, WorkspaceSnapshot } from "@taxes/shared";

import { PanelCard } from "./PanelCard.js";

interface TransactionLedgerPanelProps {
  readonly bitcoinBasis: WorkspaceSnapshot["bitcoinBasis"];
  readonly bitcoinDispositions: WorkspaceSnapshot["bitcoinDispositions"];
  readonly bitcoinLotSelections: WorkspaceSnapshot["bitcoinLotSelections"];
  readonly bitcoinLots: WorkspaceSnapshot["bitcoinLots"];
  readonly importSessions: WorkspaceSnapshot["importSessions"];
  readonly onBitcoinBasisSave: (input: SaveBitcoinBasisProfileInput) => Promise<void>;
  readonly onBitcoinLotSelectionSave: (input: SaveBitcoinLotSelectionInput) => Promise<void>;
  readonly transferMatches: WorkspaceSnapshot["transferMatches"];
  readonly transactions: WorkspaceSnapshot["transactions"];
}

export function TransactionLedgerPanel({
  bitcoinBasis,
  bitcoinDispositions,
  bitcoinLotSelections,
  bitcoinLots,
  importSessions,
  onBitcoinBasisSave,
  onBitcoinLotSelectionSave,
  transactions,
  transferMatches
}: TransactionLedgerPanelProps) {
  const pickerState = useBitcoinPickerState({
    bitcoinBasis,
    bitcoinDispositions,
    bitcoinLots,
    onBitcoinBasisSave,
    onBitcoinLotSelectionSave
  });

  return (
    <PanelCard>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Transaction ingest</Typography>
          <Typography color="text.secondary" variant="body2">
            Review-focused ledger foundations for crypto imports. Detailed transaction editing comes in a later slice.
          </Typography>
        </Stack>
        <TransactionSummaryChips
          bitcoinBasisStatus={bitcoinBasis.transitionStatus}
          bitcoinLotSelectionsCount={bitcoinLotSelections.length}
          bitcoinLotsCount={bitcoinLots.length}
          importSessionsCount={importSessions.length}
          transactionCount={transactions.length}
          transferMatchCount={transferMatches.length}
        />
        <BitcoinBasisSection
          bitcoinBasis={bitcoinBasis}
          explanation={pickerState.explanation}
          hasBitcoinBasisActivity={pickerState.hasBitcoinBasisActivity}
          method={pickerState.method}
          onExplanationChange={pickerState.setExplanation}
          onMethodChange={pickerState.setMethod}
          onSave={pickerState.handleBitcoinBasisSave}
        />
        <BitcoinLotPickerSection
          activeDisposition={pickerState.activeDisposition}
          bitcoinDispositions={bitcoinDispositions}
          bitcoinLots={pickerState.selectableLots}
          onDispositionChange={pickerState.setSelectedDispositionId}
          onLotChange={pickerState.setSelectedLotId}
          onQuantityChange={pickerState.setSelectedQuantity}
          onSave={pickerState.handleBitcoinLotSelectionSave}
          selectedDispositionId={pickerState.selectedDispositionId}
          selectedLotId={pickerState.selectedLotId}
          selectedQuantity={pickerState.selectedQuantity}
        />
        <ImportSessionsSection importSessions={importSessions} />
      </Stack>
    </PanelCard>
  );
}

function useBitcoinPickerState(input: {
  bitcoinBasis: WorkspaceSnapshot["bitcoinBasis"];
  bitcoinDispositions: WorkspaceSnapshot["bitcoinDispositions"];
  bitcoinLots: WorkspaceSnapshot["bitcoinLots"];
  onBitcoinBasisSave: (input: SaveBitcoinBasisProfileInput) => Promise<void>;
  onBitcoinLotSelectionSave: (input: SaveBitcoinLotSelectionInput) => Promise<void>;
}) {
  const [explanation, setExplanation] = useState(input.bitcoinBasis.explanation);
  const [method, setMethod] = useState<SaveBitcoinBasisProfileInput["method"]>(input.bitcoinBasis.method);
  const [selectedDispositionId, setSelectedDispositionId] = useState(input.bitcoinDispositions[0]?.sourceTransactionId ?? "");
  const [selectedLotId, setSelectedLotId] = useState(
    input.bitcoinDispositions[0]?.recommendedLotIds[0] ?? input.bitcoinLots[0]?.id ?? ""
  );
  const [selectedQuantity, setSelectedQuantity] = useState(input.bitcoinDispositions[0]?.unassignedQuantity ?? "");
  const activeDisposition = input.bitcoinDispositions.find((disposition) => disposition.sourceTransactionId === selectedDispositionId);
  const selectableLots = input.bitcoinLots.filter((lot) => parseQuantity(lot.remainingQuantity) > 0);

  const handleBitcoinBasisSave = () => {
    void input.onBitcoinBasisSave({
      explanation,
      method,
      taxYear: input.bitcoinBasis.taxYear
    });
  };
  const handleBitcoinLotSelectionSave = () => {
    if (selectedDispositionId.length === 0 || selectedLotId.length === 0 || selectedQuantity.length === 0) {
      return;
    }

    void input.onBitcoinLotSelectionSave({
      dispositionTransactionId: selectedDispositionId,
      lotId: selectedLotId,
      quantity: selectedQuantity,
      selectionMethod: "specific-identification",
      taxYear: input.bitcoinBasis.taxYear
    });
  };

  return {
    activeDisposition,
    explanation,
    handleBitcoinBasisSave,
    handleBitcoinLotSelectionSave,
    hasBitcoinBasisActivity: input.bitcoinBasis.hasPost2024Activity,
    method,
    selectableLots,
    selectedDispositionId,
    selectedLotId,
    selectedQuantity,
    setExplanation,
    setMethod,
    setSelectedDispositionId,
    setSelectedLotId,
    setSelectedQuantity
  };
}

interface TransactionSummaryChipsProps {
  readonly bitcoinBasisStatus: WorkspaceSnapshot["bitcoinBasis"]["transitionStatus"];
  readonly bitcoinLotSelectionsCount: number;
  readonly bitcoinLotsCount: number;
  readonly importSessionsCount: number;
  readonly transactionCount: number;
  readonly transferMatchCount: number;
}

function TransactionSummaryChips({
  bitcoinBasisStatus,
  bitcoinLotSelectionsCount,
  bitcoinLotsCount,
  importSessionsCount,
  transactionCount,
  transferMatchCount
}: TransactionSummaryChipsProps) {
  return (
    <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
      <Chip label={`${importSessionsCount.toString()} import session(s)`} size="small" variant="outlined" />
      <Chip label={`${transactionCount.toString()} transaction row(s)`} size="small" variant="outlined" />
      <Chip label={`${transferMatchCount.toString()} transfer review record(s)`} size="small" variant="outlined" />
      <Chip label={`BTC basis ${bitcoinBasisStatus}`} size="small" variant="outlined" />
      <Chip label={`${bitcoinLotsCount.toString()} BTC lot(s)`} size="small" variant="outlined" />
      <Chip label={`${bitcoinLotSelectionsCount.toString()} BTC pick(s)`} size="small" variant="outlined" />
    </Stack>
  );
}

interface BitcoinBasisSectionProps extends BitcoinBasisFormProps {
  readonly bitcoinBasis: WorkspaceSnapshot["bitcoinBasis"];
  readonly hasBitcoinBasisActivity: boolean;
}

function BitcoinBasisSection({
  bitcoinBasis,
  explanation,
  hasBitcoinBasisActivity,
  method,
  onExplanationChange,
  onMethodChange,
  onSave
}: BitcoinBasisSectionProps) {
  if (!hasBitcoinBasisActivity) {
    return null;
  }

  return (
    <>
      <Alert severity={bitcoinBasis.transitionStatus === "ready" ? "success" : "warning"}>
        BTC wallet-basis method: {bitcoinBasis.method}. {bitcoinBasis.explanation}
      </Alert>
      <BitcoinBasisForm
        explanation={explanation}
        method={method}
        onExplanationChange={onExplanationChange}
        onMethodChange={onMethodChange}
        onSave={onSave}
      />
    </>
  );
}

function BitcoinLotPickerSection(props: BitcoinLotPickerProps) {
  if (props.bitcoinDispositions.length === 0) {
    return null;
  }

  return <BitcoinLotPicker {...props} />;
}

function ImportSessionsSection({ importSessions }: Pick<TransactionLedgerPanelProps, "importSessions">) {
  if (importSessions.length === 0) {
    return (
      <Alert severity="info">
        Upload a brokerage statement, 1099-DA, 1099-B, or crypto wallet export to create the first staged import session.
      </Alert>
    );
  }

  return (
    <>
      {importSessions.map((session) => (
        <Stack
          direction={{ sm: "row", xs: "column" }}
          key={session.id}
          spacing={1}
          sx={(theme) => ({
            borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
            pt: 2
          })}
        >
          <Stack flex={1} spacing={0.5}>
            <Typography variant="subtitle1">{session.sourceFileName}</Typography>
            <Typography color="text.secondary" variant="body2">
              {session.sourceKind} | {session.sourceLabel} | {session.transactionCount.toString()} staged row(s)
            </Typography>
          </Stack>
          <Chip label={session.status} size="small" sx={{ textTransform: "capitalize" }} />
        </Stack>
      ))}
    </>
  );
}

interface BitcoinBasisFormProps {
  readonly explanation: string;
  readonly method: SaveBitcoinBasisProfileInput["method"];
  readonly onExplanationChange: (value: string) => void;
  readonly onMethodChange: (value: SaveBitcoinBasisProfileInput["method"]) => void;
  readonly onSave: () => void;
}

function BitcoinBasisForm({
  explanation,
  method,
  onExplanationChange,
  onMethodChange,
  onSave
}: BitcoinBasisFormProps) {
  return (
    <Stack direction={{ md: "row", xs: "column" }} spacing={1.5}>
      <TextField
        label="BTC basis method"
        onChange={(event) => {
          onMethodChange(event.target.value as SaveBitcoinBasisProfileInput["method"]);
        }}
        select
        size="small"
        sx={{ minWidth: 220 }}
        value={method}
      >
        <MenuItem value="undocumented">Undocumented</MenuItem>
        <MenuItem value="carryforward-single-wallet">Single-wallet carryforward</MenuItem>
        <MenuItem value="wallet-based-tracking">Wallet-based tracking</MenuItem>
        <MenuItem value="manual-review">Manual review</MenuItem>
      </TextField>
      <TextField
        fullWidth
        label="Explanation"
        onChange={(event) => {
          onExplanationChange(event.target.value);
        }}
        placeholder="Explain how your BTC basis should be tracked for 2025."
        size="small"
        value={explanation}
      />
      <Button onClick={onSave} size="small" sx={{ alignSelf: { md: "center", xs: "stretch" } }} variant="outlined">
        Save BTC basis
      </Button>
    </Stack>
  );
}

interface BitcoinLotPickerProps {
  readonly activeDisposition: WorkspaceSnapshot["bitcoinDispositions"][number] | undefined;
  readonly bitcoinDispositions: WorkspaceSnapshot["bitcoinDispositions"];
  readonly bitcoinLots: WorkspaceSnapshot["bitcoinLots"];
  readonly onDispositionChange: (value: string) => void;
  readonly onLotChange: (value: string) => void;
  readonly onQuantityChange: (value: string) => void;
  readonly onSave: () => void;
  readonly selectedDispositionId: string;
  readonly selectedLotId: string;
  readonly selectedQuantity: string;
}

function BitcoinLotPicker({
  activeDisposition,
  bitcoinDispositions,
  bitcoinLots,
  onDispositionChange,
  onLotChange,
  onQuantityChange,
  onSave,
  selectedDispositionId,
  selectedLotId,
  selectedQuantity
}: BitcoinLotPickerProps) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle1">BTC lot picker</Typography>
      <Typography color="text.secondary" variant="body2">
        Pick the lot you want to assign to each BTC disposal. Saved picks reduce the remaining balance so the same lot is not reused later.
      </Typography>
      <Stack direction={{ md: "row", xs: "column" }} spacing={1.5}>
        <TextField
          label="Disposition"
          onChange={(event) => {
            onDispositionChange(event.target.value);
          }}
          select
          size="small"
          sx={{ minWidth: 260 }}
          value={selectedDispositionId}
        >
          {bitcoinDispositions.map((disposition) => (
            <MenuItem key={disposition.id} value={disposition.sourceTransactionId}>
              {disposition.sourceTransactionId} | {disposition.quantity} BTC | {disposition.status}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Lot"
          onChange={(event) => {
            onLotChange(event.target.value);
          }}
          select
          size="small"
          sx={{ minWidth: 260 }}
          value={selectedLotId}
        >
          {bitcoinLots.map((lot) => (
            <MenuItem key={lot.id} value={lot.id}>
              {lot.accountLabel} | {lot.remainingQuantity} BTC remaining
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Quantity"
          onChange={(event) => {
            onQuantityChange(event.target.value);
          }}
          size="small"
          sx={{ minWidth: 160 }}
          value={selectedQuantity}
        />
        <Button onClick={onSave} size="small" sx={{ alignSelf: { md: "center", xs: "stretch" } }} variant="outlined">
          Save BTC lot
        </Button>
      </Stack>
      <BitcoinDispositionSummary activeDisposition={activeDisposition} />
    </Stack>
  );
}

function BitcoinDispositionSummary({
  activeDisposition
}: {
  readonly activeDisposition: WorkspaceSnapshot["bitcoinDispositions"][number] | undefined;
}) {
  if (activeDisposition === undefined) {
    return null;
  }

  return (
    <Alert severity={activeDisposition.status === "fully-assigned" ? "success" : "info"}>
      Unassigned BTC: {activeDisposition.unassignedQuantity}. Recommended lots:{" "}
      {activeDisposition.recommendedLotIds.length === 0 ? "none yet" : activeDisposition.recommendedLotIds.join(", ")}.
      {activeDisposition.assignedCostBasis === undefined ? "" : ` Assigned basis: $${(activeDisposition.assignedCostBasis.amountInCents / 100).toFixed(2)}.`}
      {activeDisposition.realizedGainOrLoss === undefined
        ? ""
        : ` Realized gain/loss: $${(activeDisposition.realizedGainOrLoss.amountInCents / 100).toFixed(2)}.`}
    </Alert>
  );
}

function parseQuantity(input: string): number {
  const parsed = Number(input);

  return Number.isNaN(parsed) ? 0 : parsed;
}
