/**
 * demo.ts
 *
 * Entry point for the Fireblocks × Solana Batched Transaction Demo.
 *
 * This file does three things only:
 *   1. Prints a startup banner showing the active configuration
 *   2. Calls the selected use case function(s)
 *   3. Handles any top-level errors with clear output
 *
 * All transaction logic lives in src/usecases/.
 * All infrastructure (client, polling, peers) lives in src/.
 *
 * ── Switching use cases ───────────────────────────────────────────────────────
 * Comment/uncomment lines in main() below. Run with: pnpm demo
 *
 * ── Use case summary ─────────────────────────────────────────────────────────
 *
 *   UC1 — Standard Payout Batch
 *         2 destinations → 1 txHash. Proves N outputs = 1 atomic Solana tx.
 *         Required balance: 0.03 SOL_TEST
 *
 *   UC2 — Scale Batch / Durable Nonce
 *         5 destinations → 1 txHash. Same atomicity at scale.
 *         Introduces Durable Nonces — how Fireblocks prevents blockhash
 *         expiry for large, policy-gated batches.
 *         Required balance: 0.15 SOL_TEST
 */

import "dotenv/config";
import { FireblocksError } from "@fireblocks/ts-sdk";
import { ASSET_ID, SOURCE_VAULT_ID, resolveEnv } from "./src/client.js";
import { runUC1_StandardPayoutBatch }    from "./src/usecases/uc1-payout-batch.js";
import { runUC2_ScaleDurableNonceBatch } from "./src/usecases/uc2-scale-nonce.js";

// ─── error handler ────────────────────────────────────────────────────────────

/**
 * Handles both Fireblocks-specific API errors and generic runtime errors.
 * FireblocksError carries an HTTP status and a response body — surfacing
 * both makes it much faster to diagnose auth failures, policy blocks, or
 * malformed payloads without opening the Console.
 */
function handleError(error: unknown): never {
  if (error instanceof FireblocksError) {
    console.error("\n❌ Fireblocks API error");
    console.error(`   message : ${error.message}`);
    if (error.response) {
      const r = error.response as { status?: number; data?: unknown };
      if (r.status) console.error(`   status  : ${r.status}`);
      if (r.data)   console.error(`   body    :\n${JSON.stringify(r.data, null, 2)}`);
    }
  } else if (error instanceof Error) {
    // Covers env errors (resolveEnv), polling timeouts, and anything else
    console.error(`\n❌ ${error.message}`);
  } else {
    console.error("\n❌ Unknown error:", error);
  }
  process.exit(1);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Print the active configuration so the audience can confirm the right
  // workspace and vault before any transactions fire
  console.log("═".repeat(60));
  console.log("  🔥 Fireblocks × Solana — Batched Transaction Demo");
  console.log("═".repeat(60));
  console.log(`  Asset        : ${ASSET_ID}`);
  console.log(`  Source Vault : ${SOURCE_VAULT_ID}`);
  console.log(`  Base URL     : ${resolveEnv("FIREBLOCKS_BASE_URL")}`);
  console.log("═".repeat(60));

  try {
    // ── Toggle use cases here ──────────────────────────────────────────────

    await runUC1_StandardPayoutBatch();
    // await runUC2_ScaleDurableNonceBatch();

    // ──────────────────────────────────────────────────────────────────────
  } catch (error) {
    handleError(error);
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log("  ✅ Done.");
  console.log("═".repeat(60));
}

main();
