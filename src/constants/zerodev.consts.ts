import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants'
import { extractChain } from 'viem'
import * as chains from 'viem/chains'
import { arbitrum, arbitrumSepolia } from 'viem/chains'
import { PEANUT_API_URL } from './general.consts'
import { isCapacitor } from '@/utils/capacitor'

// consts needed to define low level SDK kernel
// as per: https://docs.zerodev.app/sdk/getting-started/tutorial-passkeys
export const BUNDLER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_BUNDLER_URL!
export const PAYMASTER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PAYMASTER_URL!

// The `!` above is a build-time promise, and an env-less bundle breaks it: both read
// `undefined`, viem's http() takes that as "use the chain's public RPC", and a public
// RPC has no ERC-4337 methods — so every userOp failed with an error naming neither
// ZeroDev nor the missing variable. Assert at the transports instead of at module load,
// which would white-screen the whole app over a wallet-only misconfiguration.
function assertConfigured(entries: Array<[string, string | undefined]>) {
    const missing = entries.filter(([, value]) => !value).map(([name]) => name)
    if (missing.length) {
        throw new Error(`ZeroDev RPC is not configured — ${missing.join(' and ')} missing from this bundle`)
    }
}

export function assertZeroDevRpcUrls(bundlerUrl?: string, paymasterUrl?: string) {
    assertConfigured([
        ['NEXT_PUBLIC_ZERO_DEV_BUNDLER_URL', bundlerUrl],
        ['NEXT_PUBLIC_ZERO_DEV_PAYMASTER_URL', paymasterUrl],
    ])
}

/** Bundler alone — an unsponsored run builds no paymaster transport but still sends userOps. */
export function assertZeroDevBundlerUrl(bundlerUrl?: string) {
    assertConfigured([['NEXT_PUBLIC_ZERO_DEV_BUNDLER_URL', bundlerUrl]])
}

// Timeout for the ZeroDev bundler + paymaster RPC transports. viem's http()
// default is 10s, which intermittently trips a `TimeoutError` on
// `zd_sponsorUserOperation` during ZeroDev paymaster latency spikes — silently
// failing crypto withdrawals (and any other smart-account userOp). 30s absorbs
// the blips. Sponsorship is idempotent (returns gas-sponsorship data, submits
// nothing on-chain), so waiting longer carries no double-spend risk.
export const ZERODEV_RPC_TIMEOUT_MS = 30_000

// Passkey server URL. The backend at /passkeys/{login,register}/verify
// returns Set-Cookie: jwt-token=… which only sticks on the response origin.
//
// - Web: use the relative '/passkeys' path so the request is same-origin
//   (peanut.me) and Set-Cookie lands on peanut.me. next.config.js rewrites
//   /passkeys/:path* to PEANUT_API_URL/passkeys/:path* at the edge.
// - Native: rewrites don't exist in Capacitor's static export, so call the
//   API directly. The native auth-token store reads the JWT from the
//   response body rather than the cookie anyway, so cross-origin Set-Cookie
//   doesn't matter there.
//
// No env var override — twice now a stale NEXT_PUBLIC_ZERO_DEV_PASSKEY_SERVER_URL
// has silently broken login. Removing the footgun.
export const PASSKEY_SERVER_URL = isCapacitor() ? `${PEANUT_API_URL}/passkeys` : '/passkeys'

// Default to Arb One + Circle USDC (prod). Overridable via env so the mono
// QA harness can point the UI at Arb Sepolia + testnet USDC without forking.
// When NEXT_PUBLIC_PEANUT_WALLET_CHAIN_ID is '421614', we also default the
// token address to Circle's Arb-Sepolia testnet USDC (lowercase checksum).
import { USE_SEPOLIA } from './wallet-token.consts'

// Wallet chain & token — configurable via env for sandbox/testnet testing.
// Defaults: Arbitrum mainnet + USDC. When NEXT_PUBLIC_PEANUT_WALLET_CHAIN_ID
// is '421614' (Arb Sepolia), default token falls back to Circle's testnet USDC.
const walletChainId = Number(process.env.NEXT_PUBLIC_PEANUT_WALLET_CHAIN_ID || arbitrum.id)
export const PEANUT_WALLET_CHAIN =
    walletChainId === arbitrum.id
        ? arbitrum
        : USE_SEPOLIA
          ? arbitrumSepolia
          : extractChain({
                chains: Object.values(chains),
                id: walletChainId as (typeof chains)[keyof typeof chains]['id'],
            })
export { PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS, PEANUT_WALLET_TOKEN_SYMBOL } from './wallet-token.consts'
export const PEANUT_WALLET_TOKEN_NAME = process.env.NEXT_PUBLIC_PEANUT_WALLET_TOKEN_NAME || 'USD Coin'
export const PEANUT_WALLET_TOKEN_IMG_URL =
    'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png'

export const USDT_IN_MAINNET = '0xdac17f958d2ee523a2206206994597c13d831ec7'

/**
 * Zerodev needs these to be passed explicitly to avoid breaking changes
 * when upgrading the SDK. At moment of feature development this is
 * kernel v3.1 with entry point 0.7 This will probably not change in the
 * future.
 */
export const USER_OP_ENTRY_POINT = getEntryPoint('0.7')
export const ZERODEV_KERNEL_VERSION = KERNEL_V3_1
export { USER_OPERATION_REVERT_REASON_TOPIC } from './userop.consts'
