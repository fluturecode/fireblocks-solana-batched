# solana-batched

**Fireblocks × Solana — Batched Transaction Demo**

Demonstrates how Fireblocks serialises multiple Solana transfers into a single
atomic on-chain transaction using the `destinations[]` array. Built for SE
demos with the Solana team.

---

## What this proves

| | UC1 — Payout Batch | UC2 — Scale + Durable Nonce |
|---|---|---|
| Destinations | 2 | 5 |
| On-chain txs | **1** | **1** |
| txHash | Single hash, 2 outputs on Solscan | Single hash, 5 outputs on Solscan |
| Key concept | Atomicity | Scale + blockhash expiry solution |

**The core proof:** N destinations in one Fireblocks request = one Solana
transaction. One `txHash`. One network fee. One signature. All outputs succeed
or all roll back — guaranteed by the Solana runtime.

---

## Project structure

```
solana-batched/
├── src/
│   ├── client.ts              Fireblocks SDK singleton + env helpers
│   ├── peers.ts               Transfer peer path factory functions
│   ├── addresses.ts           Devnet destination wallet constants
│   ├── poller.ts              Lifecycle polling + tx summary printer
│   └── usecases/
│       ├── uc1-payout-batch.ts    2-destination payout batch
│       └── uc2-scale-nonce.ts     5-destination batch + Durable Nonce
├── demo.ts                    Entry point — toggle use cases here
├── .env.example               Required environment variables
├── .gitignore
├── SETUP.md                   Step-by-step setup instructions
├── package.json
└── tsconfig.json
```

---

## Quick start

```bash
# 1. Clone and install
git clone <your-repo-url> solana-batched
cd solana-batched
pnpm install

# 2. Set up environment
cp .env.example .env
# Fill in FIREBLOCKS_API_KEY, FIREBLOCKS_BASE_URL, SOURCE_VAULT_ID
# FIREBLOCKS_SECRET_KEY comes from macOS Keychain — see SETUP.md

# 3. Fund your vault (needs SOL_TEST on Solana Devnet)
# See SETUP.md Step 3

# 4. Run
pnpm demo
```

---

## Use cases

### UC1 — Standard Payout Batch

Two destinations in a single `TRANSFER` payload. Both
`SystemProgram.transfer` instructions are packed into one Solana transaction,
signed once by the Fireblocks MPC key, and broadcast as a single blob.

```
Required balance: 0.03 SOL_TEST
```

### UC2 — Scale Batch / Durable Nonce

Five destinations in one payload. Same atomicity proof as UC1 at scale.
Introduces **Durable Transaction Nonces** — how Fireblocks prevents the
`recentBlockhash` expiry problem for large, policy-gated batches.

```
Required balance: 0.15 SOL_TEST
```

Toggle between use cases in `demo.ts`:

```typescript
await runUC1_StandardPayoutBatch();
// await runUC2_ScaleDurableNonceBatch();
```

---

## Requirements

- Node.js ≥ 18
- pnpm ≥ 8
- Fireblocks Sandbox workspace with an API Admin user
- SOL_TEST balance in your source vault
- macOS Keychain entry `FIREBLOCKS_DEV_KEY` containing your PEM private key

See **SETUP.md** for the complete setup walkthrough.

---

## Tech stack

- [`@fireblocks/ts-sdk`](https://github.com/fireblocks/ts-sdk) — official TypeScript SDK
- [`tsx`](https://github.com/privatenumber/tsx) — run TypeScript directly, no build step
- [`dotenv`](https://github.com/motdotla/dotenv) — env loading
