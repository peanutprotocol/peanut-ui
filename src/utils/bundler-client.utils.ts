import { http } from 'viem'
import { createBundlerClient } from 'viem/account-abstraction'
import { PUBLIC_CLIENTS_BY_CHAIN } from '@/app/actions/clients'
import { ZERODEV_RPC_TIMEOUT_MS } from '@/constants/zerodev.consts'

/**
 * A bundler client with no account. It reads userOp receipts by hash and
 * submits userOps that are already signed. The bundler answers for any
 * sender, so one client serves the passkey kernel and the session-key
 * account alike. Null when the chain has no bundler configured.
 */
export function createChainBundlerClient(chainId: number) {
    const config = PUBLIC_CLIENTS_BY_CHAIN[chainId]
    if (!config?.bundlerUrl) return null
    return createBundlerClient({
        chain: config.chain,
        transport: http(config.bundlerUrl, { timeout: ZERODEV_RPC_TIMEOUT_MS }),
        pollingInterval: 1_000,
    })
}
