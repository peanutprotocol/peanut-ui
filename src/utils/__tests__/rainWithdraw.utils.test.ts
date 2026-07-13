/**
 * Guards the Rain withdraw admin EIP-712 payload against drift. The coordinator
 * verifies EXACTLY this structure via ERC-1271 — any silent change to the
 * domain or message shape bricks every collateral withdrawal.
 */
import { buildRainWithdrawTypedData } from '../rainWithdraw.utils'
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
