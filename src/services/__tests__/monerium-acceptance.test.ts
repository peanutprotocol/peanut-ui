import { act, renderHook, waitFor } from '@testing-library/react'
import { moneriumApi } from '@/services/monerium'
import { useMoneriumSigner } from '@/hooks/wallet/useMoneriumSigner'

const mockApiFetch = jest.fn()
const mockEnsureRootValidatorMigrated = jest.fn()
const mockEnsureClientForChain = jest.fn()
const mockRebuildClientForChain = jest.fn()
const mockAssertClientOwnedByUser = jest.fn((client) => client)
const mockHandleSendUserOpEncoded = jest.fn()
const mockSignMessage = jest.fn()
const mockKernelClient = { account: { signMessage: mockSignMessage } }

jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/utils/kernelMigration.utils', () => ({
    ensureRootValidatorMigrated: (...args: unknown[]) => mockEnsureRootValidatorMigrated(...args),
}))
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        ensureClientForChain: (...args: unknown[]) => mockEnsureClientForChain(...args),
        rebuildClientForChain: (...args: unknown[]) => mockRebuildClientForChain(...args),
        assertClientOwnedByUser: (client: unknown) => mockAssertClientOwnedByUser(client),
    }),
}))
jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ handleSendUserOpEncoded: (...args: unknown[]) => mockHandleSendUserOpEncoded(...args) }),
}))
jest.mock('@/constants/zerodev.consts', () => ({ PEANUT_WALLET_CHAIN: { id: 42161 } }))

const response = (status: number, body: unknown, ok = status >= 200 && status < 300) => ({
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
})

describe('Monerium API black-box acceptance', () => {
    const base = '/users/currency-accounts/EURE'

    beforeEach(() => mockApiFetch.mockReset())

    it('URL-encodes operation ids and history cursors as individual path/query values', async () => {
        mockApiFetch.mockResolvedValue(response(200, { operationId: 'ok' }))
        await moneriumApi.operation('id/with spaces?x=1')
        await moneriumApi.history('cursor +/with?reserved')

        expect(String(mockApiFetch.mock.calls[0][0])).toContain(`${base}/operations/id%2Fwith%20spaces%3Fx%3D1`)
        expect(String(mockApiFetch.mock.calls[1][0])).toContain(`${base}/history?cursor=cursor%20%2B%2Fwith%3Freserved`)
    })

    it('surfaces an error from a non-JSON error response', async () => {
        mockApiFetch.mockResolvedValue(response(409, 'address_linked_elsewhere', false))
        await expect(moneriumApi.link('0xsig' as `0x${string}`)).rejects.toMatchObject({ status: 409 })
    })

    it('preserves an unknown wire error and its HTTP status', async () => {
        mockApiFetch.mockResolvedValue(response(429, { error: 'provider_circuit_open' }, false))
        await expect(moneriumApi.onboarding()).rejects.toMatchObject({
            status: 429,
            code: 'provider_circuit_open',
        })
    })
})

describe('Monerium signer serialization acceptance', () => {
    beforeEach(() => {
        mockEnsureRootValidatorMigrated.mockReset().mockImplementation(async ({ client }) => client)
        mockEnsureClientForChain.mockReset().mockResolvedValue(mockKernelClient)
        mockRebuildClientForChain.mockReset().mockResolvedValue(mockKernelClient)
        mockAssertClientOwnedByUser.mockReset().mockImplementation((client) => client)
        mockSignMessage.mockReset()
    })

    it('runs migration and ownership checks before signing on Arbitrum', async () => {
        mockSignMessage.mockResolvedValue('0x1234')
        const { result } = renderHook(() => useMoneriumSigner())

        await act(async () => {
            await result.current.signMoneriumMessage('Monerium link message')
        })

        expect(mockEnsureRootValidatorMigrated).toHaveBeenCalled()
        expect(mockEnsureClientForChain).toHaveBeenCalledWith('42161')
        expect(mockAssertClientOwnedByUser).toHaveBeenCalledWith(mockKernelClient)
        expect(mockSignMessage).toHaveBeenCalledWith({ message: 'Monerium link message' })
    })

    it('does not sign when migration or ownership validation rejects', async () => {
        const { result, rerender } = renderHook(() => useMoneriumSigner())
        mockEnsureRootValidatorMigrated.mockRejectedValueOnce(new Error('migration failed'))
        await expect(result.current.signMoneriumMessage('message')).rejects.toThrow('migration failed')
        expect(mockSignMessage).not.toHaveBeenCalled()

        mockEnsureRootValidatorMigrated.mockImplementation(async ({ client }) => client)
        mockAssertClientOwnedByUser.mockImplementationOnce(() => {
            throw new Error('wrong owner')
        })
        rerender()
        await expect(result.current.signMoneriumMessage('message')).rejects.toThrow('wrong owner')
        expect(mockSignMessage).not.toHaveBeenCalled()
    })

    it('rejects overlapping signing and releases the lock after rejection', async () => {
        let rejectFirst!: (error: Error) => void
        const pendingSign = new Promise<`0x${string}`>((_resolve, reject) => {
            rejectFirst = reject
        })
        mockSignMessage.mockReturnValueOnce(pendingSign).mockResolvedValueOnce('0xabcd')
        const { result } = renderHook(() => useMoneriumSigner())

        let first!: Promise<`0x${string}`>
        act(() => {
            first = result.current.signMoneriumMessage('first')
        })
        await expect(result.current.signMoneriumMessage('overlap')).rejects.toBeDefined()
        await waitFor(() => expect(mockSignMessage).toHaveBeenCalledTimes(1))
        expect(mockSignMessage).toHaveBeenCalledTimes(1)

        await act(async () => {
            rejectFirst(new Error('wallet rejected'))
            await expect(first).rejects.toThrow('wallet rejected')
        })
        await expect(result.current.signMoneriumMessage('after rejection')).resolves.toBe('0xabcd')
    })
})
