/**
 * src/poller.ts
 *
 * Transaction lifecycle polling and result display.
 *
 * The main export is `submitAndPoll`, which is the single call used by every
 * use case. It handles the full flow end to end:
 *
 *   1. Print the request payload so the audience can see exactly what is
 *      being sent to the Fireblocks API before it fires.
 *
 *   2. Call createTransaction to submit the payload. Fireblocks returns
 *      an ID and an initial status immediately — the transaction has been
 *      accepted but not yet signed or broadcast.
 *
 *   3. Poll getTransaction in a loop, printing each state change exactly
 *      once. The lifecycle states are:
 *        SUBMITTED → PENDING_SIGNATURE → BROADCASTING → CONFIRMING → COMPLETED
 *      PENDING_SIGNATURE is where the Fireblocks MPC co-signer signs the tx.
 *      BROADCASTING is where the signed blob is sent to the Solana RPC node.
 *
 *   4. Once a terminal state is reached, print the summary:
 *      - txHash + Solscan link — the atomicity proof
 *      - Fee breakdown — batch cost vs N individual transactions
 */

import {
  TransactionRequest,
  TransactionRequestDestination,
  TransactionResponse,
  TransactionStateEnum,
  CreateTransactionResponse,
} from "@fireblocks/ts-sdk";
import { fireblocks, ASSET_ID } from "./client.js";

// ─── state sets ──────────────────────────────────────────────────────────────

/**
 * States where the transaction has reached a final outcome.
 * The poll loop exits as soon as any of these is observed.
 */
const TERMINAL_STATES = new Set<string>([
  TransactionStateEnum.Completed,
  TransactionStateEnum.Confirmed,
  TransactionStateEnum.PartiallyCompleted,
  TransactionStateEnum.Failed,
  TransactionStateEnum.Rejected,
  TransactionStateEnum.Blocked,
  TransactionStateEnum.Cancelled,
  TransactionStateEnum.Timeout,
]);

/**
 * States that represent meaningful progress milestones.
 * These are printed with a `↳` prefix to distinguish them from
 * non-milestone state changes (printed with `●`).
 */
const MILESTONE_STATES = new Set<string>([
  TransactionStateEnum.Submitted,
  TransactionStateEnum.PendingSignature,
  TransactionStateEnum.Broadcasting,
  TransactionStateEnum.Confirming,
]);

// ─── types ────────────────────────────────────────────────────────────────────

export interface PollOptions {
  intervalMs?: number; // How often to call getTransaction. Default: 3 000 ms
  timeoutMs?:  number; // Give up and throw after this long. Default: 120 000 ms
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── poll loop ────────────────────────────────────────────────────────────────

/**
 * Calls getTransaction on a loop until the transaction reaches a terminal
 * state. Logs each status change exactly once to show the lifecycle without
 * flooding the terminal with repeated lines.
 */
async function pollUntilTerminal(
  txId: string,
  opts: PollOptions = {}
): Promise<TransactionResponse> {
  const { intervalMs = 3_000, timeoutMs = 120_000 } = opts;
  const deadline = Date.now() + timeoutMs;

  // Track the last seen status so we only print when it changes
  let lastStatus = "";

  console.log(`\n   ⏳ Polling tx ${txId} …`);

  while (Date.now() < deadline) {
    const { data: tx } = await fireblocks.transactions.getTransaction({ txId });
    const status = tx.status ?? "UNKNOWN";

    // Only log when status has changed — avoids noisy repeated lines
    if (status !== lastStatus) {
      const ts     = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
      const prefix = MILESTONE_STATES.has(status) ? "   ↳" : "   ●";
      console.log(`${prefix} [${ts}] ${status}${tx.subStatus ? ` (${tx.subStatus})` : ""}`);
      lastStatus = status;
    }

    // Exit the loop as soon as we hit any terminal state
    if (TERMINAL_STATES.has(status)) return tx;

    await sleep(intervalMs);
  }

  throw new Error(`Polling timed out after ${timeoutMs / 1_000}s for tx ${txId}`);
}

// ─── summary printer ─────────────────────────────────────────────────────────

/**
 * Prints the final result of a confirmed transaction.
 *
 * The txHash line is the key proof: one hash for N destinations confirms
 * this was a single atomic Solana transaction. Opening the Solscan link will
 * show N SOL Transfer rows under a single transaction record.
 *
 * The fee breakdown uses Solana's fixed base fee of 5000 lamports
 * (0.000005 SOL) per signature. A batch pays this once regardless of
 * destination count; N individual transactions would pay it N times.
 */
function printSummary(tx: TransactionResponse, destCount: number): void {
  const status    = tx.status ?? "UNKNOWN";
  const isSuccess =
    status === TransactionStateEnum.Completed ||
    status === TransactionStateEnum.Confirmed;

  console.log(`\n   ${isSuccess ? "✅" : "❌"} Final status : ${status}`);

  if (tx.txHash) {
    console.log(`   🔗 txHash      : ${tx.txHash}`);
    console.log(`   🔍 Solscan     : https://solscan.io/tx/${tx.txHash}?cluster=devnet`);
    console.log(
      `      ↳ ${destCount} destination${destCount > 1 ? "s" : ""}, 1 txHash — ` +
      `single atomic Solana transaction.`
    );
  }

  // Surface any error detail if the transaction did not succeed
  if (tx.subStatus)        console.log(`   ⚠️  subStatus  : ${tx.subStatus}`);
  if (tx.errorDescription) console.log(`   ⛔ error      : ${tx.errorDescription}`);

  // Fee breakdown — only meaningful for multi-destination batches
  if (tx.feeInfo?.networkFee && destCount > 1) {
    const batchFee = parseFloat(tx.feeInfo.networkFee);

    // Solana charges a fixed 5 000 lamports (0.000005 SOL) per signature.
    // One batch tx = one signature = one base fee, regardless of output count.
    // N individual txs = N signatures = N × base fee.
    const perTxBaseFee  = 0.000005;
    const individualFee = perTxBaseFee * destCount;
    const saving        = Math.max(0, individualFee - batchFee);
    const savingPct     = individualFee > 0
      ? Math.round((saving / individualFee) * 100)
      : 0;

    console.log(`\n   💸 Fee breakdown`);
    console.log(`      Batch fee (1 tx)       : ${batchFee.toFixed(8)} ${tx.feeCurrency ?? ASSET_ID}`);
    console.log(`      ${destCount} individual txs would : ${individualFee.toFixed(8)} ${tx.feeCurrency ?? ASSET_ID}`);
    console.log(`      Saving                 : ~${savingPct}% — 1 signature, 1 broadcast`);
  }
}

// ─── main export ─────────────────────────────────────────────────────────────

/**
 * Submits a transaction payload to Fireblocks, polls the full lifecycle,
 * and prints the summary. This is the single entry point used by all use cases.
 *
 * @param label       - Header line printed above the payload and lifecycle
 * @param payload     - The full TransactionRequest to submit
 * @param destinations - The destinations array from the payload (used for
 *                       count-based logging and fee math)
 * @param pollOpts    - Optional overrides for polling interval and timeout
 */
export async function submitAndPoll(
  label:        string,
  payload:      TransactionRequest,
  destinations: TransactionRequestDestination[],
  pollOpts?:    PollOptions
): Promise<TransactionResponse> {
  // Print a visual header so each use case is clearly separated in the output
  const bar = "─".repeat(64);
  console.log(`\n${bar}\n▶  ${label}\n${bar}`);

  // Log the full payload — the audience can see every field before anything fires
  console.log("Payload:\n" + JSON.stringify(payload, null, 2));

  // Frame the atomicity claim before the response arrives so the audience
  // knows what to look for in the output
  console.log(
    `\n   ⚡ Submitting ${destinations.length} destination` +
    `${destinations.length > 1 ? "s" : ""} as a single atomic Solana transaction …`
  );

  // Submit to Fireblocks — returns immediately with an ID and initial status
  const { data: created }: { data: CreateTransactionResponse } =
    await fireblocks.transactions.createTransaction({ transactionRequest: payload });

  console.log(`\n   📤 id     : ${created.id}`);
  console.log(`   📋 status : ${created.status}`);

  // Poll until the transaction reaches a terminal state
  const finalTx = await pollUntilTerminal(created.id!, pollOpts);

  // Print the final summary including txHash, Solscan link, and fee breakdown
  printSummary(finalTx, destinations.length);

  return finalTx;
}