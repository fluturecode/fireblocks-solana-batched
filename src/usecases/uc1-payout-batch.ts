/**
 * src/usecases/uc1-payout-batch.ts
 *
 * UC1 — Standard Payout Batch (2 destinations)
 *
 * The simplest demonstration of Fireblocks batching on Solana.
 * One TRANSFER request, two entries in destinations[], one txHash.
 *
 * ── What happens under the hood ──────────────────────────────────────────────
 *
 * When this payload reaches Fireblocks:
 *   1. The platform serialises two SystemProgram.transfer instructions into
 *      a single Solana Transaction object.
 *   2. The MPC key signs the transaction once.
 *   3. The signed blob is broadcast to the Solana RPC endpoint as one request.
 *
 * The Solana runtime processes both outputs atomically — either both succeed
 * or the entire transaction rolls back. There is no partial state.
 *
 * One txHash on Solscan with two transfer output rows is the proof.
 *
 * ── SDK contract ─────────────────────────────────────────────────────────────
 *
 * destinations[] and the top-level destination/amount pair are mutually
 * exclusive in the Fireblocks API. Using destinations[] signals a multi-output
 * transaction. Never include both in the same payload.
 *
 * ── Idempotency ──────────────────────────────────────────────────────────────
 *
 * SESSION_ID is set once at module load time (using Date.now()). Within the
 * same process run, any retry of this function reuses the same externalTxId,
 * so Fireblocks deduplicates and returns the original transaction rather than
 * creating a duplicate. Starting a new `pnpm demo` generates a fresh ID.
 *
 * ── Required balance ─────────────────────────────────────────────────────────
 * 0.01 + 0.02 = 0.03 SOL_TEST plus network fee (~0.000005 SOL_TEST)
 */

import {
  TransactionRequest,
  TransactionRequestDestination,
  TransactionOperation,
  TransactionRequestFeeLevelEnum,
} from "@fireblocks/ts-sdk";
import { ASSET_ID } from "../client.js";
import { sourceVault, oneTimeAddress } from "../peers.js";
import { submitAndPoll } from "../poller.js";
import { DEVNET_WALLET_A, DEVNET_WALLET_B } from "../addresses.js";

// Fixed for the lifetime of this process — retries reuse this ID
const SESSION_ID = `uc1-${Date.now()}`;

export async function runUC1_StandardPayoutBatch(): Promise<void> {
  // Build the two-destination array.
  // Each entry pairs an amount (string, in SOL) with a destination peer path.
  const destinations: TransactionRequestDestination[] = [
    { amount: "0.01", destination: oneTimeAddress(DEVNET_WALLET_A) },
    { amount: "0.02", destination: oneTimeAddress(DEVNET_WALLET_B) },
  ];

  // Construct the full transaction payload.
  // source      — the vault that holds our SOL_TEST balance
  // destinations — the two recipients (replaces the top-level destination field)
  // feeLevel    — Medium is appropriate for devnet; no need for High
  // externalTxId — stable idempotency key for this session (see note above)
  const payload: TransactionRequest = {
    operation:    TransactionOperation.Transfer,
    assetId:      ASSET_ID,
    source:       sourceVault(),
    destinations,
    feeLevel:     TransactionRequestFeeLevelEnum.Medium,
    externalTxId: SESSION_ID,
    note:         "UC1 | Payout Batch: 0.01 + 0.02 SOL_TEST → 2 wallets, 1 atomic tx",
  };

  // Hand off to submitAndPoll which handles submission, lifecycle polling,
  // and the final summary including txHash and fee breakdown.
  await submitAndPoll(
    "UC1 — Standard Payout Batch (2 destinations)",
    payload,
    destinations
  );
}