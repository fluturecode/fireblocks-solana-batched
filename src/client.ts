import "dotenv/config";
import * as fs from "fs";
import { Fireblocks } from "@fireblocks/ts-sdk";

// ─── env helper ──────────────────────────────────────────────────────────────

/**
 * Reads an environment variable and throws a descriptive error if it is
 * missing. Called at module load so misconfiguration fails immediately on
 * startup rather than mid-run.
 */
export function resolveEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

// ─── key loader ──────────────────────────────────────────────────────────────

/**
 * Loads the private key directly from the file at FIREBLOCKS_SECRET_PATH.
 * Reading from disk is the most reliable approach — no shell escaping,
 * no newline corruption, no passphrase issues.
 */
function loadPrivateKey(): string {
  const keyPath = process.env.FIREBLOCKS_SECRET_PATH;
  if (keyPath) {
    return fs.readFileSync(keyPath, "utf8");
  }
  // Fall back to env var if path not set
  const keyEnv = process.env.FIREBLOCKS_SECRET_KEY;
  if (keyEnv) return keyEnv.replace(/\\n/g, "\n");
  throw new Error(
    "Neither FIREBLOCKS_SECRET_PATH nor FIREBLOCKS_SECRET_KEY is set"
  );
}

// ─── client ──────────────────────────────────────────────────────────────────

export const fireblocks = new Fireblocks({
  apiKey:    resolveEnv("FIREBLOCKS_API_KEY"),
  basePath:  resolveEnv("FIREBLOCKS_BASE_URL"),
  secretKey: loadPrivateKey(),
});

// ─── shared constants ─────────────────────────────────────────────────────────

/** Solana Devnet asset inside Fireblocks Sandbox. */
export const ASSET_ID = "SOL_TEST";

/** Vault Account ID that holds the SOL_TEST balance for this demo. */
export const SOURCE_VAULT_ID = resolveEnv("SOURCE_VAULT_ID");
