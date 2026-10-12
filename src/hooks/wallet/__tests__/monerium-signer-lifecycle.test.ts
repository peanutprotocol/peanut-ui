import { act, renderHook, waitFor } from '@testing-library/react'
import { useMoneriumSigner } from '@/hooks/wallet/useMoneriumSigner'

const mockEnsureRootValidatorMigrated = jest.fn()
const mockEnsureClientForChain = jest.fn()
const mockRebuildClientForChain = jest.fn()
const mockSignMessage = jest.fn()
const mockKernelClient = { account: { signMessage: mockSignMessage } }
const mockKernelContext = {
    ensureClientForChain: (...args: unknown[]) => mockEnsureClientForChain(...args),
    rebuildClientForChain: (...args: unknown[]) => mockRebuildClientForChain(...args),
    assertClientOwnedByUser: (client: unknown) => client,
}

jest.mock('@/utils/kernelMigration.utils', () => ({
    ensureRootValidatorMigrated: (...args: unknown[]) => mockEnsureRootValidatorMigrated(...args),
}))
jest.mock('@/context/kernelClient.context', () => ({ useKernelClient: () => mockKernelContext }))
jest.mock('@/hooks/useZeroDev', () => ({ useZeroDev: () => ({ handleSendUserOpEncoded: jest.fn() }) }))
jest.mock('@/constants/zerodev.consts', () => ({ PEANUT_WALLET_CHAIN: { id: 42161 } }))

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (error: Error) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })
    return { promise, resolve, reject }
}

describe('Monerium signer lifecycle acceptance', () => {
    beforeEach(() => {
        mockEnsureRootValidatorMigrated.mockReset().mockImplementation(async ({ client }) => client)
        mockEnsureClientForChain.mockReset().mockResolvedValue(mockKernelClient)
        mockRebuildClientForChain.mockReset().mockResolvedValue(mockKernelClient)
        mockSignMessage.mockReset().mockResolvedValue('0x1234')
        mockKernelContext.assertClientOwnedByUser = (client: unknown) => client
    })

    it('does not sign if the hook unmounts while migration is pending', async () => {
        const migration = deferred<typeof mockKernelClient>()
        mockEnsureRootValidatorMigrated.mockReturnValueOnce(migration.promise)
        const { result, unmount } = renderHook(() => useMoneriumSigner())

        let signing!: Promise<`0x${string}`>
        act(() => {
            signing = result.current.signMoneriumMessage('message')
        })
        const settled = signing.then(
            () => undefined,
            () => undefined
        )
        await waitFor(() => expect(mockEnsureRootValidatorMigrated).toHaveBeenCalledTimes(1))
        unmount()
        await act(async () => {
            migration.resolve(mockKernelClient)
        })
        await settled
        expect(mockSignMessage).not.toHaveBeenCalled()
    })

    it('does not sign if ownership callback identity changes while migration is pending', async () => {
        const migration = deferred<typeof mockKernelClient>()
        mockEnsureRootValidatorMigrated.mockReturnValueOnce(migration.promise)
        const firstCheck = jest.fn((client: unknown) => client)
        const changedCheck = jest.fn((client: unknown) => client)
        mockKernelContext.assertClientOwnedByUser = firstCheck
        const { result, rerender } = renderHook(() => useMoneriumSigner())

        let signing!: Promise<`0x${string}`>
        act(() => {
            signing = result.current.signMoneriumMessage('message')
        })
        const settled = signing.then(
            () => undefined,
            () => undefined
        )
        await waitFor(() => expect(mockEnsureRootValidatorMigrated).toHaveBeenCalledTimes(1))
        mockKernelContext.assertClientOwnedByUser = changedCheck
        rerender()
        await act(async () => {
            migration.resolve(mockKernelClient)
        })

        await settled
        expect(firstCheck).not.toHaveBeenCalled()
        expect(changedCheck).not.toHaveBeenCalled()
        expect(mockSignMessage).not.toHaveBeenCalled()
    })

    it('rejects a second hook instance while the first instance is awaiting a signature', async () => {
        const pendingSignature = deferred<`0x${string}`>()
        mockSignMessage.mockReturnValueOnce(pendingSignature.promise)
        const firstHook = renderHook(() => useMoneriumSigner())
        const secondHook = renderHook(() => useMoneriumSigner())

        let firstSigning!: Promise<`0x${string}`>
        await act(async () => {
            firstSigning = firstHook.result.current.signMoneriumMessage('first')
            await waitFor(() => expect(mockSignMessage).toHaveBeenCalledTimes(1))
        })
        await expect(secondHook.result.current.signMoneriumMessage('second')).rejects.toBeDefined()
        expect(mockSignMessage).toHaveBeenCalledTimes(1)

        await act(async () => {
            pendingSignature.resolve('0x1234')
        })
        await expect(firstSigning).resolves.toBe('0x1234')
        firstHook.unmount()
        secondHook.unmount()
    })
})
