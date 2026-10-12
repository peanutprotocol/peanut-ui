import { act, renderHook, waitFor } from '@testing-library/react'
import { useKernelClient } from '@/context/kernelClient.context'
import { useMoneriumSigner } from '../useMoneriumSigner'

const ARBITRUM = '42161'
const MESSAGE = 'I hereby declare that I am the address owner.'
const SIGNATURE = `0x${'cd'.repeat(65)}`

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
}))
jest.mock('@/context/kernelClient.context', () => ({ useKernelClient: jest.fn() }))
jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ handleSendUserOpEncoded: jest.fn(async () => ({ userOpHash: '0xhash', receipt: null })) }),
}))
const mockEnsureRootValidatorMigrated = jest.fn()
jest.mock('@/utils/kernelMigration.utils', () => ({
    ...jest.requireActual('@/utils/kernelMigration.utils'),
    ensureRootValidatorMigrated: (...args: unknown[]) => mockEnsureRootValidatorMigrated(...args),
}))

const events: string[] = []
const state = { migrated: false, ownershipFails: false, migrationFails: false }
let signMessage: jest.Mock
let kernel: {
    ensureClientForChain: jest.Mock
    getClientForChain: jest.Mock
    assertClientOwnedByUser: jest.Mock
    rebuildClientForChain: jest.Mock
}

const staleSession = () => new Error('stale session')
const isOwnershipEvent = (event: string, index: number) =>
    index > events.indexOf('migrate') &&
    (event === 'owner' || event === `get:${ARBITRUM}` || event === `ensure:${ARBITRUM}`)

beforeEach(() => {
    events.length = 0
    Object.assign(state, { migrated: false, ownershipFails: false, migrationFails: false })
    signMessage = jest.fn(async (_args: { message: string }) => {
        events.push('sign')
        return SIGNATURE
    })
    const client = { account: { address: `0x${'12'.repeat(20)}`, signMessage } }
    kernel = {
        ensureClientForChain: jest.fn(async (chainId: string) => {
            events.push(`ensure:${chainId}`)
            if (state.migrated && state.ownershipFails) throw staleSession()
            return client
        }),
        getClientForChain: jest.fn((chainId: string) => {
            events.push(`get:${chainId}`)
            if (state.ownershipFails) throw staleSession()
            return client
        }),
        assertClientOwnedByUser: jest.fn((candidate: unknown) => {
            events.push('owner')
            if (state.ownershipFails) throw staleSession()
            return candidate
        }),
        rebuildClientForChain: jest.fn(async (chainId: string) => {
            events.push(`rebuild:${chainId}`)
            return client
        }),
    }
    jest.mocked(useKernelClient).mockReturnValue(kernel as unknown as ReturnType<typeof useKernelClient>)
    mockEnsureRootValidatorMigrated.mockReset()
    mockEnsureRootValidatorMigrated.mockImplementation(async (deps: { client: unknown }) => {
        events.push('migrate')
        if (state.migrationFails) throw new Error('migration failed')
        state.migrated = true
        return deps.client
    })
})

const signer = () => renderHook(() => useMoneriumSigner()).result.current

describe('useMoneriumSigner', () => {
    it('signs the message with the Arbitrum kernel account and returns the signature', async () => {
        const { signMoneriumMessage } = signer()
        await expect(signMoneriumMessage(MESSAGE)).resolves.toBe(SIGNATURE)
        expect(signMessage).toHaveBeenCalledTimes(1)
        expect(signMessage).toHaveBeenCalledWith({ message: MESSAGE })
    })

    it('only ever touches the Arbitrum client', async () => {
        const { signMoneriumMessage } = signer()
        await signMoneriumMessage(MESSAGE)
        const chains = [
            ...kernel.ensureClientForChain.mock.calls,
            ...kernel.getClientForChain.mock.calls,
            ...kernel.rebuildClientForChain.mock.calls,
        ].map(([chainId]) => chainId)
        expect(chains.length).toBeGreaterThan(0)
        expect(new Set(chains)).toEqual(new Set([ARBITRUM]))
    })

    it('migrates the root validator, then checks the client belongs to the user, then signs', async () => {
        const { signMoneriumMessage } = signer()
        await signMoneriumMessage(MESSAGE)
        const migrated = events.indexOf('migrate')
        const owned = events.findIndex(isOwnershipEvent)
        const signed = events.indexOf('sign')
        expect(migrated).toBeGreaterThanOrEqual(0)
        expect(owned).toBeGreaterThan(migrated)
        expect(signed).toBeGreaterThan(owned)
        expect(mockEnsureRootValidatorMigrated).toHaveBeenCalledTimes(1)
        expect(mockEnsureRootValidatorMigrated).toHaveBeenCalledWith(
            expect.objectContaining({ client: expect.anything() })
        )
    })

    it('never signs when the root validator migration fails', async () => {
        state.migrationFails = true
        const { signMoneriumMessage } = signer()
        await expect(signMoneriumMessage(MESSAGE)).rejects.toThrow('migration failed')
        expect(signMessage).not.toHaveBeenCalled()
    })

    it('never signs when the ownership check fails', async () => {
        state.ownershipFails = true
        const { signMoneriumMessage } = signer()
        await expect(signMoneriumMessage(MESSAGE)).rejects.toThrow('stale session')
        expect(signMessage).not.toHaveBeenCalled()
    })

    it('propagates a signing failure to the caller', async () => {
        signMessage.mockRejectedValueOnce(new Error('user cancelled'))
        const { signMoneriumMessage } = signer()
        await expect(signMoneriumMessage(MESSAGE)).rejects.toThrow('user cancelled')
    })

    describe('one signing at a time', () => {
        const deferred = () => {
            let resolve!: (value: string) => void
            const promise = new Promise<string>((done) => {
                resolve = done
            })
            return { promise, resolve }
        }

        it.each(['straight away', 'once the first signature is requested'])(
            'rejects a second call made %s while the first is pending',
            async (when) => {
                const first = deferred()
                signMessage.mockImplementationOnce(() => first.promise)
                const { signMoneriumMessage } = signer()
                const pending = signMoneriumMessage(MESSAGE)
                if (when !== 'straight away') {
                    await waitFor(() => expect(signMessage).toHaveBeenCalled())
                }
                await expect(signMoneriumMessage('another message')).rejects.toBeDefined()
                expect(signMessage).toHaveBeenCalledTimes(when === 'straight away' ? 0 : 1)
                await act(async () => first.resolve(SIGNATURE))
                await expect(pending).resolves.toBe(SIGNATURE)
                expect(signMessage).toHaveBeenCalledTimes(1)
                expect(signMessage).not.toHaveBeenCalledWith({ message: 'another message' })
            }
        )

        it('accepts a new signing once the previous one has settled', async () => {
            const { signMoneriumMessage } = signer()
            await signMoneriumMessage(MESSAGE)
            await expect(signMoneriumMessage('second')).resolves.toBe(SIGNATURE)
            expect(signMessage).toHaveBeenCalledTimes(2)
        })

        it('accepts a new signing after the previous one failed', async () => {
            signMessage.mockRejectedValueOnce(new Error('user cancelled'))
            const { signMoneriumMessage } = signer()
            await expect(signMoneriumMessage(MESSAGE)).rejects.toThrow('user cancelled')
            await expect(signMoneriumMessage(MESSAGE)).resolves.toBe(SIGNATURE)
        })
    })
})
