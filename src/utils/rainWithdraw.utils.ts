import type { Address, Hex } from 'viem'
import {
    RAIN_WITHDRAW_EIP712_DOMAIN_NAME,
    RAIN_WITHDRAW_EIP712_DOMAIN_VERSION,
    rainWithdrawEip712Types,
} from '@/constants/rain.consts'

/** The fields of a `/rain/withdrawals/prepare` response the admin signature covers. */
export interface RainWithdrawPrep {
    collateralProxy: string
    adminSalt: string
    adminAddress: string
    tokenAddress: string
    amount: string
    recipientAddress: string
    adminNonce: string
}

/**
 * Single source of truth for the Rain withdraw admin EIP-712 payload.
 * Both the collateral-only and mixed spend paths sign EXACTLY this object;
 * any drift between what is signed and what the coordinator verifies via
 * ERC-1271 bricks the withdrawal, so it is built in one place only.
 */
export const buildRainWithdrawTypedData = (prep: RainWithdrawPrep, chainId: number) =>
    ({
        domain: {
            name: RAIN_WITHDRAW_EIP712_DOMAIN_NAME,
            version: RAIN_WITHDRAW_EIP712_DOMAIN_VERSION,
            chainId,
            verifyingContract: prep.collateralProxy as Address,
            salt: prep.adminSalt as Hex,
        },
        types: rainWithdrawEip712Types,
        primaryType: 'Withdraw',
        message: {
            user: prep.adminAddress as Address,
            asset: prep.tokenAddress as Address,
            amount: BigInt(prep.amount),
            recipient: prep.recipientAddress as Address,
            nonce: BigInt(prep.adminNonce),
        },
    }) as const
