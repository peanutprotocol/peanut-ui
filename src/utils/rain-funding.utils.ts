import { isAddress, isAddressEqual, maxUint256, zeroAddress, type Address } from 'viem'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import type { RainCardFunding } from '@/services/rain'

export type RainFundingError =
    | { kind: 'funding-unavailable'; message: string }
    /** Connected account is not the wallet Rain pulls from. */
    | { kind: 'wallet-mismatch' }
    /** Backend chain/token/operator are not a config this app can sign for. */
    | { kind: 'config-mismatch' }
    | { kind: 'user-cancelled' }
    /** The UserOp was sent but no receipt came back and the chain does not show
     *  the change yet. Uncertain, not failed — re-check before sending again. */
    | { kind: 'pending' }
    /** The UserOp succeeded but the onchain allowance is not the expected one. */
    | { kind: 'not-confirmed' }
    | { kind: 'unexpected'; message: string }

export type RainFundingResult = { ok: true } | { ok: false; error: RainFundingError }

/**
 * Detects the one-time unlimited approval this app sets, nothing more. The
 * approval is `maxUint256` and USDC lowers the allowance on every pull, so a
 * wallet that approved reads as "max minus what the card spent" — always above
 * half of max. This is NOT a statement about spending power: a smaller
 * hand-set allowance could still fund a payment. It only answers "did the user
 * give the consent this app asks for, or do we still need to ask".
 */
const UNLIMITED_APPROVAL_FLOOR = maxUint256 / 2n

export const isRainFundingApproved = (allowance: string | bigint | null | undefined): boolean => {
    if (allowance == null) return false
    try {
        return BigInt(allowance) >= UNLIMITED_APPROVAL_FLOOR
    } catch {
        return false
    }
}

/**
 * The backend funding config must be the chain and token this app's wallet
 * runs on, with a real operator. Checked BEFORE any kernel client is built, so
 * an unexpected config can never pick the chain we sign on.
 */
export const isRainFundingConfigValid = (funding: RainCardFunding): boolean =>
    funding.chainId === PEANUT_WALLET_CHAIN.id.toString() &&
    isAddress(funding.tokenAddress) &&
    isAddressEqual(funding.tokenAddress, PEANUT_WALLET_TOKEN as Address) &&
    isAddress(funding.operatorAddress) &&
    !isAddressEqual(funding.operatorAddress, zeroAddress) &&
    isAddress(funding.walletAddress)

/** The account that signs must be the wallet Rain pulls from. */
export const isRainFundingWallet = (funding: RainCardFunding, connectedAddress: Address | undefined): boolean =>
    !!connectedAddress && isAddressEqual(funding.walletAddress as Address, connectedAddress)
