import { cookies } from 'next/headers'
import { getReceiptAuthorization } from '../receipt-auth'

jest.mock('next/headers', () => ({ cookies: jest.fn() }))

const mockCookies = jest.mocked(cookies)

describe('getReceiptAuthorization', () => {
    beforeEach(() => {
        mockCookies.mockReset()
    })

    test('forwards the signed-in web session as a bearer token', async () => {
        mockCookies.mockResolvedValue({
            get: jest.fn().mockReturnValue({ value: 'owner-session' }),
        } as unknown as Awaited<ReturnType<typeof cookies>>)

        await expect(getReceiptAuthorization()).resolves.toBe('Bearer owner-session')
    })

    test('keeps public capability receipts anonymous when there is no session', async () => {
        mockCookies.mockResolvedValue({
            get: jest.fn().mockReturnValue(undefined),
        } as unknown as Awaited<ReturnType<typeof cookies>>)

        await expect(getReceiptAuthorization()).resolves.toBeUndefined()
    })
})
