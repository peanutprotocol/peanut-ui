/**
 * Run-mode detection for the FE.
 *
 * The FE doesn't have a single "mode" env var; the running configuration is
 * derived from a constellation of NEXT_PUBLIC_* values that point at
 * different APIs, chains, bundlers, etc. This module classifies them into a
 * coherent label so devs can see at a glance what they're actually wired up
 * to — surfaced in the dev banner + console log on every load.
 *
 * Classification (in priority order):
 *   - api      = local | staging | prod | unknown
 *   - chain    = arb-sepolia | arb-mainnet | unknown
 *   - signing  = harness-ecdsa | passkey  (build-time gate)
 *   - preset   = derived label combining the above
 */

import { PEANUT_API_URL } from '@/constants/general.consts'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'

export type ApiTier = 'local' | 'staging' | 'prod' | 'unknown'
export type ChainTier = 'arb-sepolia' | 'arb-mainnet' | 'unknown'
export type SigningMode = 'harness-ecdsa' | 'passkey'

export interface RunMode {
    api: ApiTier
    apiUrl: string
    chain: ChainTier
    chainId: number
    signing: SigningMode
    /** Combined human label, e.g. "sandbox · arb-sepolia · harness-ecdsa". */
    preset: string
}

function classifyApi(url: string): ApiTier {
    const u = url.toLowerCase()
    if (u.includes('localhost') || u.includes('127.0.0.1') || u.startsWith('/')) return 'local'
    if (u.includes('staging') || u.includes('-staging') || u.includes('peanut-api-ts-staging')) return 'staging'
    if (u.includes('peanut-api-ts.onrender.com') || u.includes('api.peanut.me')) return 'prod'
    return 'unknown'
}

function classifyChain(chainId: number): ChainTier {
    if (chainId === 421614) return 'arb-sepolia'
    if (chainId === 42161) return 'arb-mainnet'
    return 'unknown'
}

function classifySigning(): SigningMode {
    // Build-time gate. When set, the FE skips WebAuthn entirely.
    if (process.env.NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK === 'true') return 'harness-ecdsa'
    return 'passkey'
}

export function getRunMode(): RunMode {
    const api = classifyApi(PEANUT_API_URL)
    const chain = classifyChain(PEANUT_WALLET_CHAIN.id)
    const signing = classifySigning()

    // Preset shortcut. The combinations we actually run:
    //   sandbox        = local API + arb-sepolia + harness-ecdsa  (fully local)
    //   staging-mirror = staging API + arb-sepolia + passkey      (real staging DB; FE local)
    //   prod-real      = prod API + arb-mainnet + passkey         (real money — danger)
    //   custom         = anything else
    let preset = 'custom'
    if (api === 'local' && chain === 'arb-sepolia' && signing === 'harness-ecdsa') preset = 'sandbox'
    else if (api === 'staging' && chain === 'arb-sepolia') preset = 'staging-mirror'
    else if (api === 'prod' && chain === 'arb-mainnet') preset = 'prod-real'
    else preset = `custom (${api} · ${chain} · ${signing})`

    return { api, apiUrl: PEANUT_API_URL, chain, chainId: PEANUT_WALLET_CHAIN.id, signing, preset }
}

/**
 * Returns true if the current run-mode is "danger" — connected to real-money
 * rails (prod API + mainnet). Used by UI elements that should warn or
 * confirm before letting the user act.
 */
export function isRealMoneyMode(): boolean {
    const mode = getRunMode()
    return mode.api === 'prod' || mode.chain === 'arb-mainnet'
}

/**
 * Pretty-print the run-mode to the browser console with high-contrast styling.
 * Used at app startup (Banner mount) and on demand via `debug.mode()`. Yellow
 * background + black bold text + giant size — visually impossible to miss.
 *
 * Real-money modes get a red banner instead so the dev can never confuse
 * sandbox for prod at a glance.
 */
export function logRunMode(prefix: string = ''): RunMode {
    const m = getRunMode()
    const realMoney = isRealMoneyMode()

    const headlineStyle = realMoney
        ? 'background: #dc2626; color: #fff; font-size: 22px; font-weight: 900; padding: 10px 16px; border-radius: 4px; letter-spacing: 0.05em;'
        : 'background: #facc15; color: #000; font-size: 22px; font-weight: 900; padding: 10px 16px; border-radius: 4px; letter-spacing: 0.05em;'

    const detailStyle = 'font-size: 13px; font-weight: 600; line-height: 1.6em;'
    const tag = realMoney ? '⚠ REAL MONEY MODE' : '🟢 SANDBOX MODE'

    // eslint-disable-next-line no-console
    console.log(
        `${prefix ? prefix + ' ' : ''}%c${tag} · ${m.preset}%c\n` +
            `  api      = ${m.api}  (${m.apiUrl})\n` +
            `  chain    = ${m.chain}  (${m.chainId})\n` +
            `  signing  = ${m.signing}`,
        headlineStyle,
        detailStyle
    )

    return m
}
