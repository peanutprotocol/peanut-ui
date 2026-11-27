/**
 * useCreateLink end to end, with only the wallet send, the bundler and the
 * API mocked (TASK-24270). On 2026-10-31 a 5 USDC link funded on-chain but the
 * receipt wait timed out; the fallback guessed the index from a bigint
 * deposit count, POST /send-links rejected it, and the success screen had
 * already shown. The link must come from the chain and be recorded first.
 */
import { renderHook } from '@testing-library/react'
import type { Address, Hex } from 'viem'
import { decodeFunctionData } from 'viem'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import { getContractAddress, getLatestContractVersion, peanutVaultAbi } from '@/utils/peanut-claim.utils'
import { generateKeysFromString, getParamsFromLink } from '@/utils/peanut-link.utils'
import { LinkDepositUnconfirmedError } from '@/utils/send-link-deposit.utils'
import { captureNetworkTriagedFailure } from '@/utils/network-triage'
import { sendLinksApi } from '@/services/sendLinks'
import { SENDER, TX_HASH, USEROP_HASH, depositLog, receiptWith } from '@/utils/__tests__/send-link-deposit.fixtures'

const mockSetLoadingState = jest.fn()
jest.mock('@/context/loadingStates.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        loadingStateContext: ReactActual.createContext({
            loadingState: 'Idle',
            setLoadingState: (...args: unknown[]) => mockSetLoadingState(...args),
            isLoading: false,
        }),
    }
})
const mockSendTransactions = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => ({ sendTransactions: mockSendTransactions }) }))
let mockKernelAddress: string | undefined
jest.mock('@/hooks/useZeroDev', () => ({ useZeroDev: () => ({ address: mockKernelAddress }) }))
jest.mock('@/services/sendLinks', () => ({ sendLinksApi: { persist: jest.fn() } }))
const mockWaitForReceipt = jest.fn()
const mockGetReceipt = jest.fn()
const mockGetUserOperation = jest.fn()
const mockGetClientForChain = jest.fn((_chainId: string) => ({
    waitForUserOperationReceipt: mockWaitForReceipt,
    getUserOperationReceipt: mockGetReceipt,
    getUserOperation: mockGetUserOperation,
}))
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({ getClientForChain: mockGetClientForChain }),
}))
jest.mock('@/utils/network-triage', () => ({ captureNetworkTriagedFailure: jest.fn() }))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({
    withCeremonyFlow: (_name: string, fn: () => Promise<unknown>) => fn(),
}))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

import { useCreateLink } from '../useCreateLink'

const mockPersist = sendLinksApi.persist as jest.MockedFunction<typeof sendLinksApi.persist>
const mockCapture = captureNetworkTriagedFailure as jest.MockedFunction<typeof captureNetworkTriagedFailure>

const CHAIN_ID = PEANUT_WALLET_CHAIN.id.toString()
const VAULT = getContractAddress(CHAIN_ID, getLatestContractVersion({ chainId: CHAIN_ID }))
const AMOUNT = 5_000_000n

/** The pubKey the hook put in makeDeposit, read back from the signed calls. */
function depositedPubKey(): Address {
    const calls = mockSendTransactions.mock.calls[0][0] as { to: Address; data: Hex }[]
    const deposit = calls.find((call) => call.to === VAULT)!
    const { args } = decodeFunctionData({ abi: peanutVaultAbi, data: deposit.data })
    return args[4] as Address
}

function bundlerAnswering(receipt: ReturnType<typeof receiptWith> | null) {
    mockWaitForReceipt.mockImplementation(async () => {
        if (!receipt)
            throw Object.assign(new Error('Timed out while waiting for User Operation'), {
                name: 'WaitForUserOperationReceiptTimeoutError',
            })
        return { success: true, receipt }
    })
}

const notFound = (name: string) => Object.assign(new Error('not found'), { name })

/** What the bundler answers now for the op that had no receipt. */
function opNow(fate: 'landed' | 'pending' | 'dropped') {
    if (fate === 'landed') {
        mockGetReceipt.mockResolvedValue({
            success: true,
            receipt: receiptWith([depositLog({ index: 589n, address: VAULT })]),
        })
        return
    }
    mockGetReceipt.mockRejectedValue(notFound('UserOperationReceiptNotFoundError'))
    if (fate === 'pending') mockGetUserOperation.mockResolvedValue({ userOperation: {} })
    else mockGetUserOperation.mockRejectedValue(notFound('UserOperationNotFoundError'))
}

/** A first attempt whose op never confirmed in either wait. */
async function leaveUnconfirmedAttempt() {
    mockSendTransactions.mockResolvedValueOnce({ receipt: null, userOpHash: USEROP_HASH })
    bundlerAnswering(null)
    await expect(createLink()).rejects.toBeInstanceOf(LinkDepositUnconfirmedError)
    return depositedPubKey()
}

const createLink = (details?: Parameters<ReturnType<typeof useCreateLink>['createLink']>[1]) =>
    renderHook(() => useCreateLink()).result.current.createLink(AMOUNT, details)

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    mockKernelAddress = SENDER
    mockPersist.mockResolvedValue(undefined)
})

describe('useCreateLink', () => {
    test('builds the link from the deposit the receipt proves and records it first', async () => {
        mockSendTransactions.mockResolvedValue({
            receipt: receiptWith([depositLog({ index: 589n, address: VAULT })]),
            userOpHash: USEROP_HASH,
        })

        const { link } = await createLink({ message: 'dinner' })

        const params = getParamsFromLink(link)
        expect(params.depositIdx).toBe(589)
        // the password in the link opens exactly the deposit that was funded
        expect(generateKeysFromString(params.password).address).toBe(depositedPubKey())
        expect(mockPersist).toHaveBeenCalledTimes(1)
        expect(mockPersist.mock.calls[0][0]).toMatchObject({
            pubKey: depositedPubKey(),
            depositIdx: 589,
            txHash: TX_HASH,
            amount: AMOUNT,
            reference: 'dinner',
        })
    })

    test('a receipt timeout waits on the userOp instead of guessing the index', async () => {
        mockSendTransactions.mockResolvedValue({ receipt: null, userOpHash: USEROP_HASH })
        bundlerAnswering(receiptWith([depositLog({ index: 589n, address: VAULT })]))

        const { link } = await createLink()

        expect(getParamsFromLink(link).depositIdx).toBe(589)
        expect(mockGetClientForChain).toHaveBeenCalledWith(CHAIN_ID)
        expect(mockWaitForReceipt).toHaveBeenCalledWith(expect.objectContaining({ hash: USEROP_HASH }))
        expect(mockPersist.mock.calls[0][0]).toMatchObject({ depositIdx: 589, txHash: TX_HASH })
        // the screen stays busy through the extra wait, so no second link starts
        expect(mockSetLoadingState).toHaveBeenCalledWith('Executing transaction')
    })

    test('no receipt after the extra wait: no link, nothing recorded', async () => {
        mockSendTransactions.mockResolvedValue({ receipt: null, userOpHash: USEROP_HASH })
        bundlerAnswering(null)

        await expect(createLink()).rejects.toBeInstanceOf(LinkDepositUnconfirmedError)
        expect(mockPersist).not.toHaveBeenCalled()
    })

    test('a failed record still returns the funded link and reports it', async () => {
        mockSendTransactions.mockResolvedValue({
            receipt: receiptWith([depositLog({ index: 589n, address: VAULT })]),
            userOpHash: USEROP_HASH,
        })
        mockPersist.mockRejectedValue(new Error('Failed to fetch'))

        const { link } = await createLink()

        expect(getParamsFromLink(link).depositIdx).toBe(589)
        expect(mockCapture).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({
                tags: expect.objectContaining({ send_link_step: 'persist' }),
                extra: expect.objectContaining({ depositIdx: 589, txHash: TX_HASH, pubKey: depositedPubKey() }),
            })
        )
    })

    test('without a kernel address nothing is signed', async () => {
        mockKernelAddress = undefined
        await expect(createLink()).rejects.toThrow('Wallet is not ready')
        expect(mockSendTransactions).not.toHaveBeenCalled()
    })

    // Chip on ui#4296: with the first op still able to land, a Retry must not
    // fund a second link. It settles the first op before it signs anything.
    describe('retry after an unconfirmed deposit', () => {
        test('the first op still pending: no new deposit', async () => {
            await leaveUnconfirmedAttempt()
            opNow('pending')

            await expect(createLink()).rejects.toBeInstanceOf(LinkDepositUnconfirmedError)
            expect(mockSendTransactions).toHaveBeenCalledTimes(1)
            expect(mockPersist).not.toHaveBeenCalled()
        })

        test('the first op landed late: returns that link and records it, no new deposit', async () => {
            const firstPubKey = await leaveUnconfirmedAttempt()
            opNow('landed')

            const result = await createLink()

            expect(mockSendTransactions).toHaveBeenCalledTimes(1)
            expect(result.recovered).toBe(true)
            expect(result.amount).toBe(AMOUNT)
            const params = getParamsFromLink(result.link)
            expect(params.depositIdx).toBe(589)
            expect(generateKeysFromString(params.password).address).toBe(firstPubKey)
            expect(mockPersist.mock.calls[0][0]).toMatchObject({
                pubKey: firstPubKey,
                depositIdx: 589,
                txHash: TX_HASH,
            })

            // settled: the next link is a fresh deposit
            mockSendTransactions.mockResolvedValueOnce({
                receipt: receiptWith([depositLog({ index: 590n, address: VAULT })]),
                userOpHash: USEROP_HASH,
            })
            expect((await createLink()).recovered).toBe(false)
            expect(mockSendTransactions).toHaveBeenCalledTimes(2)
        })

        test('the first op was dropped: a new deposit goes ahead', async () => {
            await leaveUnconfirmedAttempt()
            opNow('dropped')
            mockSendTransactions.mockResolvedValueOnce({
                receipt: receiptWith([depositLog({ index: 590n, address: VAULT })]),
                userOpHash: USEROP_HASH,
            })

            const result = await createLink()

            expect(result.recovered).toBe(false)
            expect(getParamsFromLink(result.link).depositIdx).toBe(590)
            expect(mockSendTransactions).toHaveBeenCalledTimes(2)
        })

        test('another account on this device is never blocked', async () => {
            await leaveUnconfirmedAttempt()
            opNow('pending')
            mockKernelAddress = '0x3333333333333333333333333333333333333333'
            mockSendTransactions.mockResolvedValueOnce({
                receipt: receiptWith([
                    depositLog({ index: 590n, address: VAULT, sender: mockKernelAddress as Address }),
                ]),
                userOpHash: USEROP_HASH,
            })

            expect((await createLink()).recovered).toBe(false)
            expect(mockGetReceipt).not.toHaveBeenCalled()
        })
    })
})
