import { createPublicClient, http, type Address } from 'viem'
import { mainnet } from 'viem/chains'
import { rpcUrls } from '@/constants/general.consts'

let ensClient: ReturnType<typeof createPublicClient> | undefined

function getEnsClient() {
    if (!ensClient) {
        ensClient = createPublicClient({ chain: mainnet, transport: http(rpcUrls[mainnet.id]?.[0]) })
    }
    return ensClient
}

/*
 * Reverse lookups are serialized on purpose. When `/ens/reverse` is unavailable
 * every row of a history feed falls back at once, and the mainnet RPC
 * rate-limits that burst — the JustaName hook this replaces queued for the same
 * reason.
 */
let queue: Promise<unknown> = Promise.resolve()

/**
 * On-chain ENS reverse lookup (address → primary name) on mainnet.
 *
 * Replaces `@justaname.id/react`'s `usePrimaryName({ priority: 'onChain' })`,
 * which resolved through the same public-client reverse resolution but dragged
 * ethers 5.7.2 + siwe (~780 KB) into every client bundle. viem is already
 * bundled for wagmi, so this path costs no additional bytes.
 *
 * Resolves to '' when the address has no primary name; rejects when the lookup
 * itself fails, so callers can tell "no name" from "couldn't check".
 */
export function lookupPrimaryNameOnChain(address: string): Promise<string> {
    const run = queue.then(() => getEnsClient().getEnsName({ address: address as Address }))
    queue = run.catch(() => undefined)
    return run.then((name) => name ?? '')
}
