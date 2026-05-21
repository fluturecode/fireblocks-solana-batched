// check-auth.ts - bypass client.ts entirely
import "dotenv/config";
import * as fs from "fs";
import { Fireblocks } from "@fireblocks/ts-sdk";

const key = fs.readFileSync(process.env.FIREBLOCKS_SECRET_PATH!, "utf8");
console.log("Key header:", key.split("\n")[0]);
console.log("API Key:", process.env.FIREBLOCKS_API_KEY);
console.log("Base URL:", process.env.FIREBLOCKS_BASE_URL);

const fireblocks = new Fireblocks({
  apiKey:    process.env.FIREBLOCKS_API_KEY!,
  basePath:  process.env.FIREBLOCKS_BASE_URL!,
  secretKey: key,
});

console.log("vaults api:", typeof fireblocks.vaults);
console.log("getVaultAccounts:", typeof fireblocks.vaults?.getPagedVaultAccounts);

async function main() {
  try {
    const res = await fireblocks.vaults.getPagedVaultAccounts({});
    console.log("✅ Auth OK:", JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error("❌ Auth failed:", err?.message ?? err);
  }
}

main();