/**
 * The ephemeral spend key's authority is exactly its CallPolicy — these tests
 * pin the scoping rules (targets, selectors, arg conditions and their byte
 * offsets) so a refactor can't silently widen what the key may sign.
 */
import { encodeFunctionData, erc20Abi, pad, toHex, type Address, type Hex } from 'viem'
import { ParamCondition } from '@zerodev/permissions/policies'
import { rainCoordinatorAbi } from '@/constants/rain.consts'
import { PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { derivePermissions, EphemeralKeyPreflightError, type EphemeralSpendScope } from '@/utils/ephemeralSpendKey'

const ACCOUNT = '0x70f22a4db066aed9bcd2157a7b19e2e28c10c483' as Address
const PROXY = '0x1111111111111111111111111111111111111111' as Address
const COORDINATOR = '0x2222222222222222222222222222222222222222' as Address
const RECIPIENT = '0x3333333333333333333333333333333333333333' as Address

const scope = (calls: EphemeralSpendScope['calls']): EphemeralSpendScope => ({
    accountAddress: ACCOUNT,
    calls,
    withdrawAmountCap: 5_000_000n,
    collateralProxy: PROXY,
    coordinatorAddress: COORDINATOR,
})

const withdrawCall = () => ({
    to: COORDINATOR,
    value: 0n,
    data: encodeFunctionData({
        abi: rainCoordinatorAbi,
        functionName: 'withdrawAsset',
        args: [
            PROXY,
            PEANUT_WALLET_TOKEN as Address,
            5_000_000n,
            ACCOUNT,
            1_900_000_000n,
            pad('0x01', { size: 32 }),
            '0xdead' as Hex,
            [pad('0x02', { size: 32 })],
            ['0x' as Hex],
            false,
        ],
    }),
})

const transferCall = (amount: bigint) => ({
    to: PEANUT_WALLET_TOKEN as Address,
    value: 0n,
    data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [RECIPIENT, amount] }),
})

describe('derivePermissions', () => {
    it('pins withdrawAsset to proxy, asset, amount cap and self-recipient at the static offsets', () => {
        const [perm] = derivePermissions(scope([withdrawCall()]))
        expect(perm.target).toBe(COORDINATOR)
        expect(perm.rules).toEqual([
            { condition: ParamCondition.EQUAL, offset: 0, params: [pad(PROXY, { size: 32 })] },
            {
                condition: ParamCondition.EQUAL,
                offset: 32,
                params: [pad(PEANUT_WALLET_TOKEN as Address, { size: 32 })],
            },
            {
                condition: ParamCondition.LESS_THAN_OR_EQUAL,
                offset: 64,
                params: [pad(toHex(5_000_000n), { size: 32 })],
            },
            { condition: ParamCondition.EQUAL, offset: 96, params: [pad(ACCOUNT, { size: 32 })] },
        ])
    })

    it('pins an ERC20 transfer to the exact recipient with the amount as a cap', () => {
        const [perm] = derivePermissions(scope([transferCall(12_340_000n)]))
        expect(perm.target).toBe(PEANUT_WALLET_TOKEN)
        expect(perm.rules?.[0]).toEqual({
            condition: ParamCondition.EQUAL,
            offset: 0,
            params: [pad(RECIPIENT, { size: 32 })],
        })
        expect(perm.rules?.[1].condition).toBe(ParamCondition.LESS_THAN_OR_EQUAL)
        expect(perm.rules?.[1].offset).toBe(32)
        expect(BigInt(perm.rules![1].params[0])).toBe(12_340_000n)
    })

    it('pins an ERC20 approve the same way (spender + cap)', () => {
        const approve = {
            to: PEANUT_WALLET_TOKEN as Address,
            value: 0n,
            data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [RECIPIENT, 999n] }),
        }
        const [perm] = derivePermissions(scope([approve]))
        expect(perm.rules).toHaveLength(2)
        expect(perm.rules?.[0].params).toEqual([pad(RECIPIENT, { size: 32 })])
    })

    it('falls back to target+selector pinning for unknown call shapes', () => {
        const unknown = { to: RECIPIENT, value: 0n, data: '0xabcdef01aaaa' as Hex }
        const [perm] = derivePermissions(scope([unknown]))
        expect(perm).toEqual({ target: RECIPIENT, selector: '0xabcdef01' })
    })

    it('derives one permission per (target, selector) pair — the batch is fully covered, no repeats', () => {
        const perms = derivePermissions(
            scope([
                withdrawCall(),
                transferCall(1n),
                transferCall(2n),
                { to: RECIPIENT, value: 0n, data: '0xabcdef01' as Hex },
            ])
        )
        expect(perms).toHaveLength(3)
    })

    it('refuses a call without a full selector — nothing unscopable may reach the policy', () => {
        expect(() => derivePermissions(scope([{ to: RECIPIENT, value: 0n, data: '0x' as Hex }]))).toThrow(
            EphemeralKeyPreflightError
        )
    })
})
