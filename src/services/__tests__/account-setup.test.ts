import { AccountType, type IUserProfile } from '@/interfaces/interfaces'
import { completeAccountSetup } from '../account-setup'

const ADDRESS = '0x1111111111111111111111111111111111111111'

const response = (status: number): Response =>
    ({ ok: status >= 200 && status < 300, status, statusText: String(status) }) as Response

const profile = (withAccount: boolean): IUserProfile =>
    ({
        accounts: withAccount ? [{ type: AccountType.PEANUT_WALLET, identifier: ADDRESS }] : [],
        user: { accounts: [] },
    }) as unknown as IUserProfile

const complete = (
    request: jest.Mock<Promise<Response>, []>,
    fetchProfile: jest.Mock<Promise<IUserProfile | null>, []>
) =>
    completeAccountSetup({
        accountIdentifier: ADDRESS,
        accountType: AccountType.PEANUT_WALLET,
        request,
        fetchProfile,
        retryDelayMs: 0,
        wait: jest.fn().mockResolvedValue(undefined),
    })

describe('completeAccountSetup', () => {
    it('retries once after a timeout and confirms the created account', async () => {
        const timeout = Object.assign(new Error('request timed out'), { name: 'ConnectionTimeoutError' })
        const request = jest.fn().mockRejectedValueOnce(timeout).mockResolvedValueOnce(response(200))
        const fetchProfile = jest.fn().mockResolvedValueOnce(profile(false)).mockResolvedValueOnce(profile(true))

        await expect(complete(request, fetchProfile)).resolves.toEqual({ status: 'created', requestAttempts: 2 })
        expect(request).toHaveBeenCalledTimes(2)
        expect(fetchProfile.mock.invocationCallOrder[0]).toBeLessThan(request.mock.invocationCallOrder[1])
    })

    it('retries once after fetch rejects and confirms the created account', async () => {
        const request = jest
            .fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(response(200))
        const fetchProfile = jest.fn().mockResolvedValueOnce(profile(false)).mockResolvedValueOnce(profile(true))

        await expect(complete(request, fetchProfile)).resolves.toEqual({ status: 'created', requestAttempts: 2 })
        expect(request).toHaveBeenCalledTimes(2)
    })

    it('reconciles before retrying a 5xx response', async () => {
        const request = jest.fn().mockResolvedValueOnce(response(503)).mockResolvedValueOnce(response(200))
        const fetchProfile = jest.fn().mockResolvedValueOnce(profile(false)).mockResolvedValueOnce(profile(true))

        await expect(complete(request, fetchProfile)).resolves.toEqual({ status: 'created', requestAttempts: 2 })
        expect(request).toHaveBeenCalledTimes(2)
    })

    it('accepts the already-created address instead of repeating an ambiguous request', async () => {
        const request = jest.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
        const fetchProfile = jest.fn().mockResolvedValueOnce(profile(true))

        await expect(complete(request, fetchProfile)).resolves.toEqual({ status: 'reconciled', requestAttempts: 1 })
        expect(request).toHaveBeenCalledTimes(1)
    })

    it('accepts a 409 when the authenticated profile owns the exact address', async () => {
        const request = jest.fn().mockResolvedValueOnce(response(409))
        const fetchProfile = jest.fn().mockResolvedValueOnce(profile(true))

        await expect(complete(request, fetchProfile)).resolves.toEqual({ status: 'reconciled', requestAttempts: 1 })
        expect(request).toHaveBeenCalledTimes(1)
        expect(fetchProfile).toHaveBeenCalledTimes(1)
    })

    it('rejects a 409 when the authenticated profile does not own the address', async () => {
        const request = jest.fn().mockResolvedValueOnce(response(409))
        const fetchProfile = jest.fn().mockResolvedValueOnce(profile(false))

        await expect(complete(request, fetchProfile)).rejects.toMatchObject({
            kind: 'account_conflict',
            requestAttempts: 1,
            status: 409,
        })
        expect(request).toHaveBeenCalledTimes(1)
        expect(fetchProfile).toHaveBeenCalledTimes(1)
    })

    it('classifies a genuine credential rejection without retrying', async () => {
        const request = jest.fn().mockResolvedValueOnce(response(401))
        const fetchProfile = jest.fn()

        await expect(complete(request, fetchProfile)).rejects.toMatchObject({
            kind: 'invalid_credentials',
            requestAttempts: 1,
            status: 401,
        })
        expect(request).toHaveBeenCalledTimes(1)
        expect(fetchProfile).not.toHaveBeenCalled()
    })
})
