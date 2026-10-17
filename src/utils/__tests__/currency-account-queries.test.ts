import { eurcBalanceQueryOptions } from '../currency-account-queries'
import { getPublicClient } from '@/app/actions/clients'
import type { CurrencyAccount } from '@/services/currency-accounts'
import { EURC_ASSET } from '@/constants/currency-accounts.consts'

jest.mock('@/app/actions/clients', () => ({ getPublicClient: jest.fn() }))

const account: CurrencyAccount = { ...EURC_ASSET, id: 'balance', address: `0x${'12'.repeat(20)}`, isDefault: false }

it('keeps balances isolated by owner, chain, token and address', () => {
    const key = eurcBalanceQueryOptions('alice', account).queryKey
    expect(key).toEqual(['currency-account-balance', 'alice', '8453', account.tokenAddress, account.address])
    expect(eurcBalanceQueryOptions('bob', account).queryKey).not.toEqual(key)
    expect(eurcBalanceQueryOptions('alice', undefined).enabled).toBe(false)
})

it.each([
    { chainId: '42161' },
    { tokenAddress: `0x${'34'.repeat(20)}` },
    { decimals: 18 },
    { asset: 'USDC' },
    { currency: 'USD' },
    { address: 'invalid' },
])('fails closed on invalid account metadata before RPC: %j', async (override) => {
    await expect(
        eurcBalanceQueryOptions('alice', { ...account, ...override } as CurrencyAccount).queryFn()
    ).rejects.toThrow('Unsupported EURC account')
    expect(getPublicClient).not.toHaveBeenCalled()
})
