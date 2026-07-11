import { isAddress } from 'viem'
import { isNonEvmWithdrawChainId } from '@/constants/nonEvmWithdraw.consts'

/**
 * Address families for withdraw destinations. EVM chains share one 0x
 * format; Solana and Tron each have their own base58 shapes. The family is
 * always derived from the SELECTED chain — never inferred from the address
 * string alone (every Tron address also matches the Solana length range).
 */
export type WithdrawAddressFamily = 'evm' | 'solana' | 'tron'

/** Base58 (no 0/O/I/l), 32–44 chars — Solana ed25519 account. */
export const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
/** Base58check mainnet Tron address — 'T' + 33 chars. */
export const TRON_ADDRESS_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/

export function addressFamilyForChainId(chainId?: string | number | null): WithdrawAddressFamily {
    if (chainId != null && isNonEvmWithdrawChainId(chainId)) {
        return String(chainId).toLowerCase() as WithdrawAddressFamily
    }
    return 'evm'
}

export function isValidAddressForFamily(address: string, family: WithdrawAddressFamily): boolean {
    switch (family) {
        case 'solana':
            return SOLANA_ADDRESS_REGEX.test(address)
        case 'tron':
            return TRON_ADDRESS_REGEX.test(address)
        case 'evm':
            return isAddress(address)
    }
}
