/**
 * A saved bank account and a saved crypto address are renamed through two
 * different routes. This pins the account one, so a drawer wired to the wrong
 * adapter fails here rather than in production.
 */
import { accountsApi } from '../accounts'
import { apiFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

const response = (status: number, body: unknown): Response =>
    ({ ok: status >= 200 && status < 300, status, json: jest.fn().mockResolvedValue(body) }) as unknown as Response

beforeEach(() => jest.clearAllMocks())

it('PATCHes the account route with the label', async () => {
    mockApiFetch.mockResolvedValue(response(200, { account: { id: 'account-1', label: 'Payroll' } }))

    const account = await accountsApi.rename('account-1', 'Payroll')

    expect(mockApiFetch).toHaveBeenCalledWith('/users/accounts/account-1', {
        method: 'PATCH',
        body: JSON.stringify({ label: 'Payroll' }),
    })
    expect(account.label).toBe('Payroll')
})

it('throws on a rejected label rather than reporting success', async () => {
    mockApiFetch.mockResolvedValue(response(400, { message: 'too long' }))

    await expect(accountsApi.rename('account-1', 'x'.repeat(16))).rejects.toBeDefined()
})
