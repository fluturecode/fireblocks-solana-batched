import {
  DestinationTransferPeerPath,
  SourceTransferPeerPath,
  TransferPeerPathType,
} from "@fireblocks/ts-sdk";
import { SOURCE_VAULT_ID } from "./client.js";

/**
 * Builds the source peer for the configured vault account.
 * Pass an explicit `id` to override the default SOURCE_VAULT_ID.
 */
export function sourceVault(id = SOURCE_VAULT_ID): SourceTransferPeerPath {
  return { type: TransferPeerPathType.VaultAccount, id };
}

/**
 * Builds a ONE_TIME_ADDRESS destination peer.
 *
 * This peer type allows sending to any valid base58 Solana address without
 * needing to whitelist it in your workspace first. Fireblocks validates the
 * address format before signing and broadcasting.
 */
export function oneTimeAddress(address: string): DestinationTransferPeerPath {
  return {
    type: TransferPeerPathType.OneTimeAddress,
    oneTimeAddress: { address },
  };
}
