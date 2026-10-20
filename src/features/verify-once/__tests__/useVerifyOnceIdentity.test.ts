import { act, renderHook } from '@testing-library/react'
import { startVerifyOnceIdentity } from '@/app/actions/kyc-verify-once'
import { useVerifyOnceIdentity } from '../useVerifyOnceIdentity'

jest.mock('@/app/actions/kyc-verify-once', () => ({ startVerifyOnceIdentity: jest.fn() }))
const start = jest.mocked(startVerifyOnceIdentity)
const session = (attemptId: string) => ({
    kind: 'session' as const,
    session: { attemptId, token: `token-${attemptId}`, applicantId: 'fixture-applicant', sdkConfig: {} } as never,
})

beforeEach(() => start.mockReset())

it('uses each replacement for the next refresh and omits preselection on base retries', async () => {
    start
        .mockResolvedValueOnce(session('second'))
        .mockResolvedValueOnce(session('third'))
        .mockResolvedValueOnce(session('third'))
    const { result } = renderHook(() => useVerifyOnceIdentity())
    await act(async () => {
        await result.current.open('first')
    })
    expect(result.current.session?.sdkConfig).toBeUndefined()
    await act(async () => {
        await result.current.refreshToken()
    })
    await act(async () => {
        await result.current.refreshToken()
    })
    expect(start.mock.calls.map(([id, document]) => [id, document])).toEqual([
        ['first', undefined],
        ['second', undefined],
        ['third', undefined],
    ])
    expect(result.current.session?.attemptId).toBe('third')
})

it('sends one token request for simultaneous opens', async () => {
    let resolve!: (value: ReturnType<typeof session>) => void
    start.mockReturnValue(
        new Promise((done) => {
            resolve = done
        })
    )
    const { result } = renderHook(() => useVerifyOnceIdentity())
    await act(async () => {
        const first = result.current.open('first')
        await result.current.open('first')
        resolve(session('first'))
        await first
    })
    expect(start).toHaveBeenCalledTimes(1)
})

it('does not reopen after closing an in-flight token request', async () => {
    let resolve!: (value: ReturnType<typeof session>) => void
    start.mockReturnValue(
        new Promise((done) => {
            resolve = done
        })
    )
    const { result } = renderHook(() => useVerifyOnceIdentity())
    await act(async () => {
        const opening = result.current.open('first')
        result.current.close()
        resolve(session('second'))
        await opening
    })
    expect(result.current.session).toBeNull()
})

it('a closed session ignores a late refresh', async () => {
    start.mockResolvedValueOnce(session('first'))
    const { result } = renderHook(() => useVerifyOnceIdentity())
    await act(async () => {
        await result.current.open('first')
    })
    let resolve!: (value: ReturnType<typeof session>) => void
    start.mockReturnValue(
        new Promise((done) => {
            resolve = done
        })
    )
    await act(async () => {
        const refresh = result.current.refreshToken()
        result.current.close()
        resolve(session('second'))
        await expect(refresh).rejects.toThrow('Verification session closed')
    })
    expect(result.current.session).toBeNull()
})

it('a document-required refresh closes the SDK and requests the ID step', async () => {
    start.mockResolvedValueOnce(session('first')).mockResolvedValueOnce({ kind: 'document-required' })
    const { result } = renderHook(() => useVerifyOnceIdentity())
    await act(async () => {
        await result.current.open('first')
    })
    await act(async () => {
        await expect(result.current.refreshToken()).rejects.toThrow()
    })
    expect(result.current.session).toBeNull()
    expect(result.current.documentRequired).toBe(true)
})
