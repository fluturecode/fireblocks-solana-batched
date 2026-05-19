/**
 * src/usecases/uc2-scale-nonce.ts
 *
 * UC2 — Scale Batch / Durable Nonce (5 destinations)
 *
 * The same single-tx atomicity as UC1, now at scale — five destinations in
 * one payload. This use case also introduces Durable Transaction Nonces,
 * which is how Fireblocks makes large batches production-safe on Solana.
 *
 * ── Why scale matters ────────────────────────────────────────────────────────
 *
 * UC1 proves the concept with 2 destinations. UC2 shows it holds at 5
 * (and by extension at any N the Solana transaction size limit allows).
 * The fee saving scales linearly: 5 destinations still pay one base fee.
 *
 * ── The Durable Nonce problem ────────────────────────────────────────────────
 *
 * Every standard Solana transaction includes a recentBlockhash — a reference
 * to a recent block that proves the transaction is fresh and prevents replay.
 * The problem: this hash expires after ~150 slots (~60–90 seconds).
 *
 * For a batch routed through a multi-approver policy engine, the signing
 * window can easily exceed that. When it does, Solana rejects the transaction
 * on-chain: "Blockhash not found". The transaction must be rebuilt and
 * resubmitted from scratch.
 *
 * ── How Fireblocks solves it: Durable Transaction Nonces (DTNs) ─────────────
 *
 * Fireblocks transparently replaces the recentBlockhash with a Durable Nonce:
 *
 *   1. A Nonce Account is pre-funded on-chain and associated with the source
 *      vault. It stores a single nonce value.
 *
 *   2. The recentBlockhash field in the transaction is replaced by the nonce
 *      account's stored value. This value does NOT expire — it is valid until
 *      the transaction that consumes it lands on-chain.
 *
 *   3. Fireblocks prepends an AdvanceNonceAccount instruction as ix[0].
 *      This instruction is authorised by the nonce account's authority key,
 *      which Fireblocks manages as an MPC key pair.
 *
 *   4. When the transaction lands on-chain, AdvanceNonceAccount executes first,
 *      rotating the stored nonce to a new value atomically. The old nonce is
 *      consumed and can never be reused — preventing replay attacks.
 *
 * The result: the transaction can sit in a policy queue for minutes or hours
 * without the blockhash expiring. The signing window is unlimited.
 *
 * ── What this means for your code ────────────────────────────────────────────
 *
 * Nothing changes in the SDK payload. The platform intercepts and wraps the
 * transaction transparently when Durable Nonces are enabled in workspace
 * policy. The payload below is identical to UC1's structure — just more
 * destinations. Fireblocks handles the nonce mechanics underneath.
 *
 * Enable: Console → Workspace Settings → Transaction Policy → Durable Nonces
 *
 * ── Required balance ─────────────────────────────────────────────────────────
 * 0.01 + 0.02 + 0.03 + 0.04 + 0.05 = 0.15 SOL_TEST plus network fee
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
import {
  DEVNET_WALLET_A,
  DEVNET_WALLET_B,
  DEVNET_WALLET_C,
  DEVNET_WALLET_D,
  DEVNET_WALLET_E,
} from "../addresses.js";

const SESSION_ID = `uc2-${Date.now()}`;

// Each target pairs a wallet address with a label (for the console map)
// and an amount in SOL_TEST. Amounts are staggered so each output is
// distinguishable by value in the Solscan transaction detail view.
const TARGETS = [
  { address: DEVNET_WALLET_A, amount: "0.01", label: "Wallet A" },
  { address: DEVNET_WALLET_B, amount: "0.02", label: "Wallet B" },
  { address: DEVNET_WALLET_C, amount: "0.03", label: "Wallet C" },
  { address: DEVNET_WALLET_D, amount: "0.04", label: "Wallet D" },
  { address: DEVNET_WALLET_E, amount: "0.05", label: "Wallet E" },
];

export async function runUC2_ScaleDurableNonceBatch(): Promise<void> {
  // Print the destination map before submitting so the audience can see
  // all five outputs mapped out before watching the lifecycle run
  console.log("\n   Destination map:");
  TARGETS.forEach(({ label, amount, address }, i) => {
    console.log(`     [${i + 1}] ${amount} ${ASSET_ID} → ${label} (${address})`);
  });

  // Build the destinations array from TARGETS.
  // Each entry is a (amount, peer path) pair — same structure as UC1,
  // just five entries instead of two.
  const destinations: TransactionRequestDestination[] = TARGETS.map(
    ({ address, amount }) => ({ amount, destination: oneTimeAddress(address) })
  );

  // The payload structure is identical to UC1. Fireblocks handles the
  // Durable Nonce wrapping underneath — no special fields required here.
  const payload: TransactionRequest = {
    operation:    TransactionOperation.Transfer,
    assetId:      ASSET_ID,
    source:       sourceVault(),
    destinations,
    feeLevel:     TransactionRequestFeeLevelEnum.Medium,
    externalTxId: SESSION_ID,
    note: [
      "UC2 | Scale Batch (5 destinations).",
      "Fireblocks uses Durable Nonces: AdvanceNonceAccount prepended as ix[0],",
      "recentBlockhash replaced with non-expiring nonce value.",
    ].join(" "),
  };

  // Wider timeout for UC2 — a 5-destination batch through a policy engine
  // may take longer to reach PENDING_SIGNATURE than a 2-destination batch.
  await submitAndPoll(
    "UC2 — Scale Batch / Durable Nonce (5 destinations)",
    payload,
    destinations,
    { intervalMs: 3_000, timeoutMs: 180_000 }
  );
}