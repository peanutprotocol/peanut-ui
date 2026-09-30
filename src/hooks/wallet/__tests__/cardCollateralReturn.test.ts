/**
 * Card balance return: the provider-withdrawable card balance goes back to the
 * same wallet, bounded by a fresh provider read. A return whose outcome is not
 * known is recorded (ids and hashes only, across reloads) and settled from its
 * own evidence before anything else is sent.
 */
jest.mock('@/context/kernelClient.context', () => ({ useKernelClient: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: jest.fn() }))
jest.mock('@/hooks/useZeroDev', () => ({ useZeroDev: jest.fn() }))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: jest.fn(),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
jest.mock('../useGrantSessionKey', () => ({ useGrantSessionKey: jest.fn() }))
jest.mock('@/app/actions/clients', () => ({ peanutPublicClient: { readContract: jest.fn() } }))

import { decodeFunctionData, type Hash, type TransactionReceipt } from 'viem'
import { rainCoordinatorAbi } from '@/constants/rain.consts'
import { API_ERROR_CODES, ApiError } from '@/services/api-error'
import {
    RainCooldownError,
    StaleCardApprovalError,
    type PrepareRainWithdrawalInput,
    type PrepareRainWithdrawalResponse,
    type RainCardOverview,
    type RainWithdrawalStatus,
} from '@/services/rain'
import {
    CollateralReturnError,
    PendingCollateralReturns,
    collateralReturnPath,
    returnCardCollateral,
    type CollateralReturnDeps,
} from '../cardCollateralReturn'

const WALLET = '0x1111111111111111111111111111111111111111'
const OTHER = '0x2222222222222222222222222222222222222222'
const COORDINATOR = '0x3333333333333333333333333333333333333333'
const PROXY = '0x4444444444444444444444444444444444444444'
const TOKEN = '0x5555555555555555555555555555555555555555'
const HEX32 = `0x${'ab'.repeat(32)}`
const SIG = `0x${'cd'.repeat(65)}` as const
const TX = `0x${'ee'.repeat(32)}` as Hash
const OTHER_TX = `0x${'99'.repeat(32)}` as Hash
const USER_OP = `0x${'77'.repeat(32)}` as Hash
const OWNER = `user-1:${WALLET}`
const EXPIRES_AT = 1_800_000_600
const NOW_MS = 1_800_000_000_000
/** Past the signature expiry and the API's 5-minute margin. */
const AFTER_EXPIRY_MS = (EXPIRES_AT + 5 * 60 + 1) * 1000

const overview = (
    spendingPower: number | null,
    { grant = true, unavailable = false, pendingCharges = 0 } = {}
): RainCardOverview => ({
    status: { hasApplication: true },
    balance:
        spendingPower === null
            ? null
            : { creditLimit: 0, spendingPower, pendingCharges, postedCharges: 0, balanceDue: 0 },
    ...(unavailable ? { balanceUnavailable: true } : {}),
    cards: [
        {
            id: 'card-1',
            rainCardId: 'rain-1',
            last4: '0420',
            expiryMonth: 6,
            expiryYear: 2069,
            status: 'ACTIVE',
            network: 'visa',
            issuedAt: '2026-01-01T00:00:00Z',
            hasWithdrawApproval: grant,
        },
    ],
})

let prepCount = 0
const prepared = (input: PrepareRainWithdrawalInput, over: Partial<PrepareRainWithdrawalResponse> = {}) => ({
    preparationId: `prep-${++prepCount}`,
    coordinatorAddress: COORDINATOR,
    collateralProxy: PROXY,
    adminAddress: WALLET,
    chainId: '137',
    tokenAddress: TOKEN,
    // cents in, USDC units out
    amount: (BigInt(input.amount) * 10_000n).toString(),
    recipientAddress: input.recipientAddress,
    directTransfer: input.directTransfer,
    adminSalt: HEX32,
    adminNonce: '0',
    executorSignature: SIG,
    executorSalt: HEX32,
    expiresAt: EXPIRES_AT,
    ...over,
})

const status = (
    state: RainWithdrawalStatus['state'],
    reason: RainWithdrawalStatus['reason'],
    txHash: string | null = null
): RainWithdrawalStatus => ({ preparationId: 'prep-1', state, reason, chainId: '137', txHash, expiresAt: null })

const receipt = () => ({ transactionHash: TX, status: 'success' }) as unknown as TransactionReceipt

const passkeyDismissed = () => Object.assign(new Error('The operation was not allowed.'), { name: 'NotAllowedError' })
const held = () => new ApiError('held', { status: 409, code: API_ERROR_CODES.WITHDRAWAL_PENDING_CONFIRMATION })

/** A local storage stand-in: a new store over the same one is a page reload. */
const memoryStorage = () => {
    const data = new Map<string, string>()
    return {
        data,
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
        removeItem: (k: string) => void data.delete(k),
    }
}

let storage: ReturnType<typeof memoryStorage>

type MockedDeps = CollateralReturnDeps &
    Record<
        | 'readOverview'
        | 'prepare'
        | 'submit'
        | 'stamp'
        | 'readStatus'
        | 'cancelPreparation'
        | 'cancelVerified'
        | 'readyRootPath'
        | 'signAdmin'
        | 'sendRootUserOp'
        | 'findUserOpReceipt'
        | 'isChanged'
        | 'onStart',
        jest.Mock
    >

function setup(over: Partial<Record<keyof CollateralReturnDeps, unknown>> = {}): MockedDeps {
    return {
        owner: OWNER,
        wallet: WALLET,
        chainId: 137,
        pending: new PendingCollateralReturns(() => storage),
        readOverview: jest.fn(async () => overview(1_234.7)),
        prepare: jest.fn(async (input: PrepareRainWithdrawalInput) => prepared(input)),
        submit: jest.fn(async () => ({ txHash: TX })),
        stamp: jest.fn(async () => undefined),
        readStatus: jest.fn(async () => status('pending', 'confirming')),
        cancelPreparation: jest.fn(),
        cancelVerified: jest.fn(async () => undefined),
        readyRootPath: jest.fn(async () => undefined),
        signAdmin: jest.fn(async () => SIG),
        sendRootUserOp: jest.fn(async (_calls: unknown, onBroadcastAttempt: () => void) => {
            onBroadcastAttempt()
            return { userOpHash: USER_OP, receipt: receipt() as TransactionReceipt | null }
        }),
        findUserOpReceipt: jest.fn(async (): Promise<{ success: boolean; receipt: TransactionReceipt } | null> => null),
        isChanged: jest.fn(() => false),
        onStart: jest.fn(),
        // Inside the provider signature window of every preparation.
        nowMs: () => NOW_MS,
        ...over,
    } as MockedDeps
}

const failure = async (promise: Promise<unknown>) => {
    const e = await promise.then(
        () => null,
        (err: unknown) => err
    )
    expect(e).toBeInstanceOf(CollateralReturnError)
    return (e as CollateralReturnError).kind
}

const noGrant = () => jest.fn(async () => overview(1_234, { grant: false }))

beforeEach(() => {
    prepCount = 0
    storage = memoryStorage()
})

describe('returnCardCollateral — the amount', () => {
    it('a confirmed zero sends nothing and asks for nothing', async () => {
        const deps = setup({ readOverview: jest.fn(async () => overview(0)) })
        await expect(returnCardCollateral(deps)).resolves.toEqual({ kind: 'nothing' })
        expect(deps.onStart).not.toHaveBeenCalled()
        expect(deps.prepare).not.toHaveBeenCalled()
        expect(deps.signAdmin).not.toHaveBeenCalled()
    })

    it('sub-cent dust stays: it is not a return', async () => {
        const deps = setup({ readOverview: jest.fn(async () => overview(0.4)) })
        await expect(returnCardCollateral(deps)).resolves.toEqual({ kind: 'nothing' })
        expect(deps.prepare).not.toHaveBeenCalled()
    })

    it.each([
        ['the read failed', () => Promise.reject(new Error('offline'))],
        ['the provider balance is unavailable', async () => overview(null, { unavailable: true })],
        ['only a cached figure is available', async () => overview(5_000, { unavailable: true })],
    ])('unknown is not zero: %s stops before any prompt', async (_label, read) => {
        const deps = setup({ readOverview: jest.fn(read) })
        expect(await failure(returnCardCollateral(deps))).toBe('balance-unavailable')
        expect(deps.onStart).not.toHaveBeenCalled()
        expect(deps.prepare).not.toHaveBeenCalled()
    })

    it('asks for the fresh provider figure in whole cents, paid to the same wallet', async () => {
        const deps = setup()
        await returnCardCollateral(deps)
        expect(deps.readOverview).toHaveBeenCalledTimes(1)
        expect(deps.prepare).toHaveBeenCalledWith({ amount: '1234', recipientAddress: WALLET, directTransfer: true })
    })

    it('pending holds are excluded: only the provider spending power moves', async () => {
        const deps = setup({ readOverview: jest.fn(async () => overview(700, { pendingCharges: 500 })) })
        await returnCardCollateral(deps)
        expect(deps.prepare).toHaveBeenCalledWith(expect.objectContaining({ amount: '700' }))
    })

    it.each([
        ['more than the fresh balance', { amount: (1_235n * 10_000n).toString() }],
        ['another recipient', { recipientAddress: OTHER }],
        ['another payout mode', { directTransfer: false }],
        ['a zero amount', { amount: '0' }],
    ])('a preparation for %s is backed out before any signature', async (_label, over) => {
        const deps = setup({ prepare: jest.fn(async (input: PrepareRainWithdrawalInput) => prepared(input, over)) })
        expect(await failure(returnCardCollateral(deps))).toBe('failed')
        expect(deps.signAdmin).not.toHaveBeenCalled()
        expect(deps.cancelPreparation).toHaveBeenCalledWith('prep-1')
    })
})

describe('returnCardCollateral — with a stored withdrawal permission', () => {
    it('prepares, signs once and lets the backend submit; no root UserOp and nothing left recorded', async () => {
        const deps = setup()
        await expect(returnCardCollateral(deps)).resolves.toEqual({
            kind: 'returned',
            via: 'grant',
            preparationId: 'prep-1',
            txHash: TX,
        })
        expect(deps.onStart).toHaveBeenCalledTimes(1)
        expect(deps.signAdmin).toHaveBeenCalledTimes(1)
        expect(deps.submit).toHaveBeenCalledWith(
            expect.objectContaining({ preparationId: 'prep-1', adminSignature: SIG, recipientAddress: WALLET })
        )
        expect(deps.readyRootPath).not.toHaveBeenCalled()
        expect(deps.sendRootUserOp).not.toHaveBeenCalled()
        expect(storage.data.size).toBe(0)
    })

    it('a dismissed passkey stops the attempt and backs the draft out', async () => {
        const deps = setup({ signAdmin: jest.fn(() => Promise.reject(passkeyDismissed())) })
        expect(await failure(returnCardCollateral(deps))).toBe('cancelled')
        expect(deps.cancelPreparation).toHaveBeenCalledWith('prep-1')
        expect(deps.submit).not.toHaveBeenCalled()
    })

    it('a cooldown is reported with its wait and nothing is signed', async () => {
        const deps = setup({ prepare: jest.fn(() => Promise.reject(new RainCooldownError('wait', 90))) })
        const e = await returnCardCollateral(deps).catch((err: CollateralReturnError) => err)
        expect(e).toMatchObject({ kind: 'cooldown', retryAfterSec: 90 })
        expect(deps.signAdmin).not.toHaveBeenCalled()
    })

    it('a withdrawal the backend still holds is pending, not a new send', async () => {
        const deps = setup({ prepare: jest.fn(() => Promise.reject(held())) })
        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        expect(deps.signAdmin).not.toHaveBeenCalled()
    })

    it('an unknown submit is recorded without its signature and settled from the status read, never re-sent', async () => {
        const readStatus = jest
            .fn()
            .mockResolvedValueOnce(status('pending', 'submission_held'))
            .mockResolvedValueOnce(status('completed', 'receipt_confirmed', TX))
        const deps = setup({ submit: jest.fn(() => Promise.reject(held())), readStatus })

        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        const stored = [...storage.data.values()].join()
        expect(stored).toContain('prep-1')
        expect(stored).not.toContain(SIG.slice(2, 20))
        expect(stored).not.toContain(HEX32.slice(2, 20))

        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        await expect(returnCardCollateral(deps)).resolves.toEqual({
            kind: 'returned',
            via: 'grant',
            preparationId: 'prep-1',
            txHash: TX,
        })
        expect(readStatus).toHaveBeenCalledWith('prep-1')
        expect(deps.submit).toHaveBeenCalledTimes(1)
        expect(deps.prepare).toHaveBeenCalledTimes(1)
        expect(deps.readOverview).toHaveBeenCalledTimes(1)
        expect(storage.data.size).toBe(0)
    })

    it.each([
        ['a generic 400', new ApiError('Bad request', { status: 400 })],
        ['a 404', new ApiError('No active card found', { status: 404 })],
        ['a 409 without a code', new ApiError('Intent already processing', { status: 409 })],
        ['a timeout', new Error('The request timed out')],
    ])('%s from the first submit is not proof nothing was sent', async (_label, error) => {
        const deps = setup({ submit: jest.fn(() => Promise.reject(error)) })
        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        expect(deps.pending.get(OWNER)).toEqual({ via: 'grant', preparationId: 'prep-1' })
    })

    it('an unknown earlier return blocks even when the balance now reads zero', async () => {
        const deps = setup({
            submit: jest.fn(() => Promise.reject(new Error('network'))),
            readOverview: jest.fn().mockResolvedValueOnce(overview(1_234)).mockResolvedValue(overview(0)),
        })
        await failure(returnCardCollateral(deps))
        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        expect(deps.readOverview).toHaveBeenCalledTimes(1)
        expect(deps.pending.get(OWNER)).toBeDefined()
    })

    it('a status read that fails is not an answer', async () => {
        const deps = setup({
            submit: jest.fn(() => Promise.reject(new Error('network'))),
            readStatus: jest.fn(() =>
                Promise.reject(new ApiError('unavailable', { status: 503, code: 'WITHDRAWAL_STATUS_UNAVAILABLE' }))
            ),
        })
        await failure(returnCardCollateral(deps))
        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        expect(deps.pending.get(OWNER)).toBeDefined()
        expect(deps.prepare).toHaveBeenCalledTimes(1)
    })

    it('an earlier return the backend proves did nothing is settled; the retry uses a fresh amount', async () => {
        const readOverview = jest.fn().mockResolvedValueOnce(overview(1_234)).mockResolvedValueOnce(overview(900))
        const submit = jest.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ txHash: TX })
        const deps = setup({
            readOverview,
            submit,
            readStatus: jest.fn(async () => status('failed', 'rejected')),
        })
        await failure(returnCardCollateral(deps))
        await expect(returnCardCollateral(deps)).resolves.toMatchObject({ kind: 'returned', preparationId: 'prep-2' })
        expect(deps.prepare).toHaveBeenCalledTimes(2)
        expect(deps.prepare).toHaveBeenLastCalledWith(expect.objectContaining({ amount: '900' }))
    })

    it('a record survives a reload and is settled from the backend status', async () => {
        const first = setup({ submit: jest.fn(() => Promise.reject(held())) })
        await failure(returnCardCollateral(first))

        // Page reload: a new store over the same storage.
        const reloaded = setup({ readStatus: jest.fn(async () => status('completed', 'receipt_confirmed', TX)) })
        await expect(returnCardCollateral(reloaded)).resolves.toMatchObject({
            kind: 'returned',
            preparationId: 'prep-1',
        })
        expect(reloaded.prepare).not.toHaveBeenCalled()
        expect(reloaded.submit).not.toHaveBeenCalled()
    })

    it.each([
        ['a typed stale refusal', new StaleCardApprovalError('re-enable')],
        [
            'a coded stale refusal',
            new ApiError('re-enable', { status: 409, code: API_ERROR_CODES.STALE_CARD_APPROVAL }),
        ],
        [
            'a definitive submission failure',
            new ApiError('failed', { status: 502, code: API_ERROR_CODES.WITHDRAWAL_SUBMISSION_FAILED }),
        ],
    ])('%s permits an explicit root retry with no new grant', async (_l, err) => {
        const deps = setup({ submit: jest.fn(() => Promise.reject(err)) })
        expect(await failure(returnCardCollateral(deps))).toBe('failed')
        expect(collateralReturnPath(deps.pending, OWNER, { hasWithdrawApproval: true })).toBe('root')

        await expect(returnCardCollateral(deps)).resolves.toMatchObject({ kind: 'returned', via: 'root' })
        expect(deps.submit).toHaveBeenCalledTimes(1)
        expect(deps.readyRootPath).toHaveBeenCalledTimes(1)
        expect(deps.prepare).toHaveBeenLastCalledWith(expect.objectContaining({ directTransfer: false }))
        const [calls] = deps.sendRootUserOp.mock.calls[0] as unknown as [{ data: Hash }[]]
        expect(calls).toHaveLength(1)
        expect(decodeFunctionData({ abi: rainCoordinatorAbi, data: calls[0].data }).functionName).toBe('withdrawAsset')
    })

    it.each([
        [
            'an expired signature',
            new ApiError('expired', { status: 410, code: API_ERROR_CODES.WITHDRAWAL_SIGNATURE_EXPIRED }),
        ],
        ['a moved controller', new ApiError('updated', { status: 409, code: API_ERROR_CODES.RAIN_CONTROLLER_CHANGED })],
    ])('%s does not prove the stored permission unusable: the retry uses it again', async (_l, err) => {
        const submit = jest.fn().mockRejectedValueOnce(err).mockResolvedValueOnce({ txHash: TX })
        const deps = setup({ submit })
        expect(await failure(returnCardCollateral(deps))).toBe('failed')
        expect(collateralReturnPath(deps.pending, OWNER, { hasWithdrawApproval: true })).toBe('grant')

        await expect(returnCardCollateral(deps)).resolves.toMatchObject({ kind: 'returned', via: 'grant' })
        expect(deps.readyRootPath).not.toHaveBeenCalled()
        expect(deps.sendRootUserOp).not.toHaveBeenCalled()
    })

    it('a dismissed passkey keeps the stored permission path', async () => {
        const deps = setup({ signAdmin: jest.fn(() => Promise.reject(passkeyDismissed())) })
        expect(await failure(returnCardCollateral(deps))).toBe('cancelled')
        expect(collateralReturnPath(deps.pending, OWNER, { hasWithdrawApproval: true })).toBe('grant')
    })
})

describe('returnCardCollateral — root path (no stored permission)', () => {
    it('sends only withdrawAsset to the same wallet, then stamps the mined hash', async () => {
        const deps = setup({ readOverview: noGrant() })
        await expect(returnCardCollateral(deps)).resolves.toEqual({
            kind: 'returned',
            via: 'root',
            preparationId: 'prep-1',
            txHash: TX,
        })
        expect(deps.readyRootPath).toHaveBeenCalledTimes(1)
        expect(deps.prepare).toHaveBeenCalledWith({
            amount: '1234',
            recipientAddress: WALLET,
            directTransfer: false,
            totalAmountCents: '1234',
        })
        expect(deps.submit).not.toHaveBeenCalled()

        const [calls] = deps.sendRootUserOp.mock.calls[0] as unknown as [{ to: string; value: bigint; data: Hash }[]]
        expect(calls).toHaveLength(1)
        expect(calls[0].to).toBe(COORDINATOR)
        expect(calls[0].value).toBe(0n)
        const decoded = decodeFunctionData({ abi: rainCoordinatorAbi, data: calls[0].data })
        expect(decoded.functionName).toBe('withdrawAsset')
        const args = decoded.args as readonly unknown[]
        expect(args[2]).toBe(12_340_000n)
        expect(String(args[3]).toLowerCase()).toBe(WALLET)
        expect(args[9]).toBe(false)

        expect(deps.stamp).toHaveBeenCalledWith({ preparationId: 'prep-1', txHash: TX })
        expect(storage.data.size).toBe(0)
    })

    it('a dismissed setup step stops before anything is prepared', async () => {
        const deps = setup({
            readOverview: noGrant(),
            readyRootPath: jest.fn(() => Promise.reject(passkeyDismissed())),
        })
        expect(await failure(returnCardCollateral(deps))).toBe('cancelled')
        expect(deps.prepare).not.toHaveBeenCalled()
    })

    it('a dismissed send backs the draft out and records nothing', async () => {
        const deps = setup({
            readOverview: noGrant(),
            sendRootUserOp: jest.fn(() => Promise.reject(passkeyDismissed())),
        })
        expect(await failure(returnCardCollateral(deps))).toBe('cancelled')
        expect(deps.cancelPreparation).toHaveBeenCalledWith('prep-1')
        expect(storage.data.size).toBe(0)
    })

    it('no receipt yet: the UserOp is settled from its own receipt, then stamped once', async () => {
        const findUserOpReceipt = jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ success: true, receipt: receipt() })
        const deps = setup({
            readOverview: noGrant(),
            sendRootUserOp: jest.fn(async (_calls: unknown, onBroadcastAttempt: () => void) => {
                onBroadcastAttempt()
                return { userOpHash: USER_OP, receipt: null }
            }),
            findUserOpReceipt,
            readStatus: jest.fn(async () => status('pending', 'not_submitted')),
        })

        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        expect(deps.pending.get(OWNER)).toEqual({
            via: 'root',
            preparationId: 'prep-1',
            expiresAt: EXPIRES_AT,
            userOpHash: USER_OP,
        })
        // Still inside the signature window: no cancel is asked for.
        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        expect(deps.cancelVerified).not.toHaveBeenCalled()
        await expect(returnCardCollateral(deps)).resolves.toMatchObject({ kind: 'returned', via: 'root', txHash: TX })

        expect(findUserOpReceipt).toHaveBeenCalledWith(USER_OP)
        expect(deps.sendRootUserOp).toHaveBeenCalledTimes(1)
        expect(deps.prepare).toHaveBeenCalledTimes(1)
        expect(deps.stamp).toHaveBeenCalledTimes(1)
    })

    it('a lost stamp response is resolved from the status read: the same hash on record settles it', async () => {
        const deps = setup({
            readOverview: noGrant(),
            stamp: jest.fn(() => Promise.reject(new Error('network'))),
            readStatus: jest.fn(async () => status('pending', 'confirming', TX)),
        })
        await expect(returnCardCollateral(deps)).resolves.toMatchObject({ kind: 'returned', txHash: TX })
        expect(deps.readStatus).toHaveBeenCalledWith('prep-1')
        expect(deps.stamp).toHaveBeenCalledTimes(1)
        expect(storage.data.size).toBe(0)
    })

    it('the hash is kept before the stamp: an unreadable answer is retried from it, never re-sent', async () => {
        const readStatus = jest
            .fn()
            .mockRejectedValueOnce(new ApiError('unavailable', { status: 503 }))
            .mockResolvedValueOnce(status('pending', 'confirming', TX))
        const deps = setup({
            readOverview: noGrant(),
            stamp: jest.fn(() => Promise.reject(new Error('network'))),
            readStatus,
        })
        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        expect(deps.pending.get(OWNER)).toEqual({
            via: 'root',
            preparationId: 'prep-1',
            expiresAt: EXPIRES_AT,
            userOpHash: USER_OP,
            txHash: TX,
        })

        await expect(returnCardCollateral(deps)).resolves.toMatchObject({ kind: 'returned', txHash: TX })
        expect(deps.stamp).toHaveBeenCalledTimes(1)
        expect(deps.sendRootUserOp).toHaveBeenCalledTimes(1)
        expect(deps.prepare).toHaveBeenCalledTimes(1)
    })

    it('a stamp the backend never saw is sent again with the same hash; a 409 settles only once that hash is on record', async () => {
        const stamp = jest
            .fn()
            .mockRejectedValueOnce(new ApiError('boom', { status: 500 }))
            .mockRejectedValueOnce(new ApiError('Intent already processing', { status: 409 }))
        const readStatus = jest
            .fn()
            .mockResolvedValueOnce(status('pending', 'not_submitted'))
            .mockResolvedValueOnce(status('pending', 'not_submitted'))
            .mockResolvedValueOnce(status('pending', 'confirming', TX))
        const deps = setup({ readOverview: noGrant(), stamp, readStatus })
        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        await expect(returnCardCollateral(deps)).resolves.toMatchObject({ kind: 'returned', txHash: TX })
        expect(stamp).toHaveBeenNthCalledWith(2, { preparationId: 'prep-1', txHash: TX })
        expect(deps.sendRootUserOp).toHaveBeenCalledTimes(1)
    })

    it.each([
        ['a different hash', status('pending', 'needs_reconciliation', OTHER_TX)],
        ['a cancelled preparation without this hash', status('cancelled', 'cancelled')],
        ['a failed preparation without this hash', status('failed', 'not_executed')],
    ])('a 409 stamp with %s on record stays unresolved: no new return, no cancel', async (_label, answer) => {
        const deps = setup({
            readOverview: noGrant(),
            stamp: jest.fn(() => Promise.reject(new ApiError('Intent already cancelled', { status: 409 }))),
            readStatus: jest.fn(async () => answer),
            nowMs: () => AFTER_EXPIRY_MS,
        })
        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        expect(deps.pending.get(OWNER)).toMatchObject({ txHash: TX })
        expect(deps.prepare).toHaveBeenCalledTimes(1)
        expect(deps.sendRootUserOp).toHaveBeenCalledTimes(1)
        // a known successful receipt never goes through the cancel route
        expect(deps.cancelVerified).not.toHaveBeenCalled()
    })

    it('a different hash on record is a conflict: nothing is stamped over it and nothing new is sent', async () => {
        const deps = setup({
            readOverview: noGrant(),
            stamp: jest.fn().mockRejectedValueOnce(new Error('network')),
            readStatus: jest.fn(async () => status('pending', 'needs_reconciliation', OTHER_TX)),
        })
        await failure(returnCardCollateral(deps))
        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        expect(deps.stamp).toHaveBeenCalledTimes(1)
        expect(deps.prepare).toHaveBeenCalledTimes(1)
    })

    it('a broadcast with no hash stays unknown even when the backend reports it cancelled or expired', async () => {
        const readStatus = jest
            .fn()
            .mockResolvedValueOnce(status('cancelled', 'cancelled'))
            .mockResolvedValueOnce(status('failed', 'not_executed'))
            .mockResolvedValueOnce(status('completed', 'receipt_confirmed', TX))
        const deps = setup({
            readOverview: noGrant(),
            sendRootUserOp: jest.fn(async (_calls: unknown, onBroadcastAttempt: () => void) => {
                onBroadcastAttempt()
                throw new Error('bundler connection reset')
            }),
            readStatus,
        })
        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        expect(await failure(returnCardCollateral(deps))).toBe('pending')
        await expect(returnCardCollateral(deps)).resolves.toMatchObject({ kind: 'returned', txHash: TX })
        expect(deps.prepare).toHaveBeenCalledTimes(1)
        expect(deps.sendRootUserOp).toHaveBeenCalledTimes(1)
        // inside the signature window: the cancel route is never asked
        expect(deps.cancelVerified).not.toHaveBeenCalled()
    })

    describe('no hash, signature expired: the verified backend cancel', () => {
        const unknownSend = () =>
            jest
                .fn()
                .mockImplementationOnce(async (_calls: unknown, onBroadcastAttempt: () => void) => {
                    onBroadcastAttempt()
                    throw new Error('bundler connection reset')
                })
                .mockImplementation(async (_calls: unknown, onBroadcastAttempt: () => void) => {
                    onBroadcastAttempt()
                    return { userOpHash: USER_OP, receipt: receipt() }
                })

        it('a server-verified cancel read back as cancelled settles it; the retry starts a fresh return', async () => {
            let now = NOW_MS
            const readStatus = jest
                .fn()
                .mockResolvedValueOnce({ ...status('pending', 'not_submitted'), expiresAt: EXPIRES_AT })
                .mockResolvedValueOnce(status('cancelled', 'cancelled'))
                .mockResolvedValue(status('pending', 'not_submitted'))
            const deps = setup({
                readOverview: jest
                    .fn()
                    .mockResolvedValueOnce(overview(1_234, { grant: false }))
                    .mockResolvedValue(overview(900, { grant: false })),
                sendRootUserOp: unknownSend(),
                readStatus,
                nowMs: () => now,
            })
            expect(await failure(returnCardCollateral(deps))).toBe('pending')

            now = AFTER_EXPIRY_MS
            await expect(returnCardCollateral(deps)).resolves.toMatchObject({
                kind: 'returned',
                preparationId: 'prep-2',
            })
            expect(deps.cancelVerified).toHaveBeenCalledTimes(1)
            expect(deps.cancelVerified).toHaveBeenCalledWith('prep-1')
            expect(deps.prepare).toHaveBeenLastCalledWith(expect.objectContaining({ amount: '900' }))
            expect(deps.sendRootUserOp).toHaveBeenCalledTimes(2)
        })

        it.each([
            ['the chain check failed', new ApiError('Could not verify', { status: 503 })],
            ['the movement was found', new ApiError('already has an on-chain footprint', { status: 409 })],
            ['the signature can still execute', new ApiError('may still execute', { status: 409 })],
            ['the request failed', new Error('network')],
        ])('%s: stays pending, nothing new is sent', async (_label, error) => {
            const deps = setup({
                readOverview: noGrant(),
                sendRootUserOp: unknownSend(),
                readStatus: jest.fn(async () => status('pending', 'not_submitted')),
                cancelVerified: jest.fn(() => Promise.reject(error)),
            })
            expect(await failure(returnCardCollateral(deps))).toBe('pending')
            deps.nowMs = () => AFTER_EXPIRY_MS
            expect(await failure(returnCardCollateral(deps))).toBe('pending')
            expect(deps.cancelVerified).toHaveBeenCalledWith('prep-1')
            expect(deps.pending.get(OWNER)).toMatchObject({ preparationId: 'prep-1' })
            expect(deps.prepare).toHaveBeenCalledTimes(1)
            expect(deps.sendRootUserOp).toHaveBeenCalledTimes(1)
        })

        it('a cancel accepted but not read back as cancelled stays pending', async () => {
            const deps = setup({
                readOverview: noGrant(),
                sendRootUserOp: unknownSend(),
                readStatus: jest
                    .fn()
                    .mockResolvedValueOnce(status('pending', 'not_submitted'))
                    .mockResolvedValue(status('pending', 'needs_reconciliation')),
            })
            expect(await failure(returnCardCollateral(deps))).toBe('pending')
            deps.nowMs = () => AFTER_EXPIRY_MS
            expect(await failure(returnCardCollateral(deps))).toBe('pending')
            expect(deps.pending.get(OWNER)).toBeDefined()
            expect(deps.prepare).toHaveBeenCalledTimes(1)
        })

        it('evidence on record is never cancelled, even after expiry', async () => {
            const deps = setup({
                readOverview: noGrant(),
                sendRootUserOp: unknownSend(),
                readStatus: jest.fn(async () => status('pending', 'confirming')),
            })
            expect(await failure(returnCardCollateral(deps))).toBe('pending')
            deps.nowMs = () => AFTER_EXPIRY_MS
            expect(await failure(returnCardCollateral(deps))).toBe('pending')
            expect(deps.cancelVerified).not.toHaveBeenCalled()
        })

        it('a zero balance after expiry does not clear it without the verified cancel', async () => {
            const deps = setup({
                readOverview: jest
                    .fn()
                    .mockResolvedValueOnce(overview(1_234, { grant: false }))
                    .mockResolvedValue(overview(0, { grant: false })),
                sendRootUserOp: unknownSend(),
                readStatus: jest.fn(async () => status('pending', 'not_submitted')),
                cancelVerified: jest.fn(() => Promise.reject(new ApiError('Could not verify', { status: 503 }))),
            })
            expect(await failure(returnCardCollateral(deps))).toBe('pending')
            deps.nowMs = () => AFTER_EXPIRY_MS
            expect(await failure(returnCardCollateral(deps))).toBe('pending')
            expect(deps.readOverview).toHaveBeenCalledTimes(1)
            expect(deps.pending.get(OWNER)).toBeDefined()
        })
    })

    it('a mined revert settles the record and the retry starts from a fresh read', async () => {
        const deps = setup({
            readOverview: noGrant(),
            sendRootUserOp: jest
                .fn()
                .mockImplementationOnce(async (_calls: unknown, onBroadcastAttempt: () => void) => {
                    onBroadcastAttempt()
                    return { userOpHash: USER_OP, receipt: null }
                })
                .mockImplementationOnce(async (_calls: unknown, onBroadcastAttempt: () => void) => {
                    onBroadcastAttempt()
                    return { userOpHash: USER_OP, receipt: receipt() }
                }),
            findUserOpReceipt: jest.fn(async () => ({ success: false, receipt: receipt() })),
        })
        await failure(returnCardCollateral(deps))
        await expect(returnCardCollateral(deps)).resolves.toMatchObject({ kind: 'returned', preparationId: 'prep-2' })
        expect(deps.readOverview).toHaveBeenCalledTimes(2)
    })
})

describe('returnCardCollateral — account or wallet switch', () => {
    it('a switch after the balance read prepares nothing', async () => {
        const isChanged = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(false).mockReturnValue(true)
        const deps = setup({ isChanged })
        expect(await failure(returnCardCollateral(deps))).toBe('account-changed')
        expect(deps.readOverview).toHaveBeenCalledTimes(1)
        expect(deps.prepare).not.toHaveBeenCalled()
    })

    it('a switch during the signature sends nothing and backs the draft out', async () => {
        let changed = false
        const deps = setup({
            isChanged: jest.fn(() => changed),
            signAdmin: jest.fn(async () => {
                changed = true
                return SIG
            }),
        })
        expect(await failure(returnCardCollateral(deps))).toBe('account-changed')
        expect(deps.submit).not.toHaveBeenCalled()
        expect(deps.sendRootUserOp).not.toHaveBeenCalled()
        expect(deps.cancelPreparation).toHaveBeenCalledWith('prep-1')
    })

    it('a switch during recovery stamps nothing and sends nothing', async () => {
        let changed = false
        const deps = setup({
            readOverview: noGrant(),
            sendRootUserOp: jest.fn(async (_calls: unknown, onBroadcastAttempt: () => void) => {
                onBroadcastAttempt()
                return { userOpHash: USER_OP, receipt: null }
            }),
            isChanged: jest.fn(() => changed),
        })
        await failure(returnCardCollateral(deps))
        deps.findUserOpReceipt.mockImplementation(async () => {
            changed = true
            return { success: true, receipt: receipt() }
        })
        expect(await failure(returnCardCollateral(deps))).toBe('account-changed')
        expect(deps.stamp).not.toHaveBeenCalled()
        expect(deps.readStatus).not.toHaveBeenCalled()
        expect(deps.prepare).toHaveBeenCalledTimes(1)
    })

    it('a switch before recovery reads nothing', async () => {
        storage.setItem(
            `peanut.cardCollateralReturn.v1:${OWNER}`,
            JSON.stringify({ op: { via: 'grant', preparationId: 'prep-1' } })
        )
        const deps = setup({ isChanged: jest.fn(() => true) })
        expect(await failure(returnCardCollateral(deps))).toBe('account-changed')
        expect(deps.readStatus).not.toHaveBeenCalled()
    })

    it('records are kept per user and wallet', async () => {
        const deps = setup({ submit: jest.fn(() => Promise.reject(held())) })
        await failure(returnCardCollateral(deps))
        const other = setup({ owner: `user-2:${WALLET}` })
        await expect(returnCardCollateral(other)).resolves.toMatchObject({ kind: 'returned' })
        expect(other.readStatus).not.toHaveBeenCalled()
    })
})

describe('PendingCollateralReturns', () => {
    it('a second caller joins the running return instead of starting another', async () => {
        const pending = new PendingCollateralReturns(() => storage)
        let resolve!: () => void
        const run = jest.fn(() => new Promise<{ kind: 'nothing' }>((r) => (resolve = () => r({ kind: 'nothing' }))))
        const a = pending.runExclusive('owner', run)
        const b = pending.runExclusive('owner', run)
        resolve()
        await expect(Promise.all([a, b])).resolves.toEqual([{ kind: 'nothing' }, { kind: 'nothing' }])
        expect(run).toHaveBeenCalledTimes(1)
    })

    it('ignores a malformed stored record and keeps working without storage', () => {
        storage.setItem('peanut.cardCollateralReturn.v1:owner', '{"op":{"via":"grant","preparationId":""}}')
        expect(new PendingCollateralReturns(() => storage).get('owner')).toBeUndefined()

        const noStorage = new PendingCollateralReturns(() => undefined)
        noStorage.set('owner', { via: 'grant', preparationId: 'prep-1' })
        expect(noStorage.get('owner')).toEqual({ via: 'grant', preparationId: 'prep-1' })
    })
})
