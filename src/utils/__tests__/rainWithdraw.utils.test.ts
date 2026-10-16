/**
 * Guards the Rain withdraw admin EIP-712 payload against drift. The coordinator
 * verifies EXACTLY this structure via ERC-1271 — any silent change to the
 * domain or message shape bricks every collateral withdrawal.
 *
 * Also covers the shared withdrawal leaf used by the spend engines and the card
 * balance return: one admin signature helper and one submit-body builder.
 */
import type { Hex } from 'viem'
import type { PrepareRainWithdrawalResponse } from '@/services/rain'

const mockWithCeremonyPurpose = jest.fn((_purpose: string, run: () => Promise<unknown>) => run())
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({
    withCeremonyPurpose: (purpose: string, run: () => Promise<unknown>) => mockWithCeremonyPurpose(purpose, run),
}))

import { buildRainWithdrawTypedData, signRainWithdrawAdmin, toSubmitWithdrawalInput } from '../rainWithdraw.utils'
import {
    RAIN_WITHDRAW_EIP712_DOMAIN_NAME,
    RAIN_WITHDRAW_EIP712_DOMAIN_VERSION,
    rainWithdrawEip712Types,
} from '@/constants/rain.consts'

const PREP = {
    collateralProxy: '0x4c0b6e210726550c1842c445bc2caf2708c74587',
    adminSalt: '0x' + '11'.repeat(32), // synthetic 32-byte salt (public calldata in prod)
    adminAddress: '0x70f22a4db066aed9bcd2157a7b19e2e28c10c483',
    tokenAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    amount: '30040000',
    recipientAddress: '0xb45104ef75c214990b23dcf7354e5fcb8ec4342a',
    adminNonce: '7',
}

describe('buildRainWithdrawTypedData', () => {
    it('builds the exact domain + message the coordinator verifies', () => {
        const typed = buildRainWithdrawTypedData(PREP, 42161)
        expect(typed).toEqual({
            domain: {
                name: RAIN_WITHDRAW_EIP712_DOMAIN_NAME,
                version: RAIN_WITHDRAW_EIP712_DOMAIN_VERSION,
                chainId: 42161,
                verifyingContract: PREP.collateralProxy,
                salt: PREP.adminSalt,
            },
            types: rainWithdrawEip712Types,
            primaryType: 'Withdraw',
            message: {
                user: PREP.adminAddress,
                asset: PREP.tokenAddress,
                amount: 30040000n,
                recipient: PREP.recipientAddress,
                nonce: 7n,
            },
        })
    })
})

const SIG = `0x${'cd'.repeat(65)}` as Hex
const PREPARED: PrepareRainWithdrawalResponse = {
    preparationId: 'prep-1',
    coordinatorAddress: '0x3333333333333333333333333333333333333333',
    collateralProxy: PREP.collateralProxy,
    adminAddress: PREP.adminAddress,
    chainId: '42161',
    tokenAddress: PREP.tokenAddress,
    amount: PREP.amount,
    recipientAddress: PREP.recipientAddress,
    directTransfer: true,
    adminSalt: PREP.adminSalt,
    adminNonce: PREP.adminNonce,
    executorSignature: `0x${'ef'.repeat(65)}`,
    executorSalt: `0x${'12'.repeat(32)}`,
    expiresAt: 1_800_000_600,
}

describe('signRainWithdrawAdmin', () => {
    it('signs exactly the admin typed data, labelled for ceremony telemetry', async () => {
        const signTypedData = jest.fn(async () => SIG)
        await expect(signRainWithdrawAdmin({ signTypedData }, PREPARED, 42161)).resolves.toBe(SIG)
        expect(mockWithCeremonyPurpose).toHaveBeenCalledWith('admin_eip712', expect.any(Function))
        expect(signTypedData).toHaveBeenCalledWith(buildRainWithdrawTypedData(PREPARED, 42161))
    })

    it('a rejected passkey rejects with the same error', async () => {
        const dismissed = Object.assign(new Error('The operation was not allowed.'), { name: 'NotAllowedError' })
        const signTypedData = jest.fn(() => Promise.reject(dismissed))
        await expect(signRainWithdrawAdmin({ signTypedData }, PREPARED, 1)).rejects.toBe(dismissed)
    })
})

describe('toSubmitWithdrawalInput', () => {
    it('carries the prepared fields and the admin signature, and nothing else', () => {
        expect(toSubmitWithdrawalInput(PREPARED, SIG)).toEqual({
            preparedCoordinatorAddress: PREPARED.coordinatorAddress,
            preparationId: 'prep-1',
            amount: PREPARED.amount,
            recipientAddress: PREPARED.recipientAddress,
            directTransfer: true,
            adminSalt: PREPARED.adminSalt,
            adminNonce: '7',
            adminSignature: SIG,
            executorSignature: PREPARED.executorSignature,
            executorSalt: PREPARED.executorSalt,
            expiresAt: 1_800_000_600,
        })
    })
})
