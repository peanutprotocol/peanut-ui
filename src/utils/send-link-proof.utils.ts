/**
 * Proof that this reader holds the send link (TASK-24599).
 *
 * The link's pubKey is public on-chain, so the API cannot tell the claimer from
 * anyone who read the contract. The password in the link's `#p=` part derives
 * the link's private key; signing a timestamped message with it proves the
 * reader holds the link without sending the password or the key. The API
 * answers the note, the attachment and the sender and claimer details only with
 * a valid proof (once its enforcement switch is on).
 *
 * Must match peanut-api-ts `src/routes/send-links/read-proof.ts` byte for byte.
 * It rides in the query string, not a header: a custom header would add a CORS
 * preflight round trip to a guest's link load.
 */
import { signMessage } from 'viem/accounts'
import type { Hex } from 'viem'

export function sendLinkReadMessage(pubKey: string, chainId: string, unixSeconds: number): string {
    return `peanut-send-link-read:${pubKey.toLowerCase()}:${chainId}:${unixSeconds}`
}

/**
 * `<unixSeconds>.<signature>`. Signed per request: it costs well under a
 * millisecond, and the API refuses a proof older than 10 minutes, which a
 * long claim-status poll would outlive.
 */
export async function sendLinkReadProof(
    privateKey: Hex,
    pubKey: string,
    chainId: string,
    unixSeconds = Math.floor(Date.now() / 1000)
): Promise<string> {
    const signature = await signMessage({ message: sendLinkReadMessage(pubKey, chainId, unixSeconds), privateKey })
    return `${unixSeconds}.${signature}`
}
