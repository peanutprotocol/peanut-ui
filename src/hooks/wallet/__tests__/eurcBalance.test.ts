import { eurcBalanceQueryOptions } from '../useCurrencyAccounts'
import type { CurrencyAccount } from '@/services/currency-accounts'
import { getPublicClient } from '@/app/actions/clients'

jest.mock('@/app/actions/clients', () => ({ getPublicClient: jest.fn() }))
jest.mock('@/services/currency-accounts', () => ({ currencyAccountsApi: {} }))

const eurc: CurrencyAccount = {
    id: 'eurc-1',
    asset: 'EURC',
    currency: 'EUR',
    chainId: '8453',
    decimals: 6,
    tokenAddress: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42',
    address: `0x${'12'.repeat(20)}`,
    isDefault: false,
}

it('uses an owner, chain, token and address-specific balance key', () => {
    const key = eurcBalanceQueryOptions('alice', eurc).queryKey
    expect(key).toEqual(['currency-account-balance', 'alice', '8453', eurc.tokenAddress, eurc.address])
    expect(eurcBalanceQueryOptions('bob', eurc).queryKey).not.toEqual(key)
    expect(eurcBalanceQueryOptions('alice', undefined).enabled).toBe(false)
})

it.each([
    { chainId: '42161' },
    { tokenAddress: `0x${'34'.repeat(20)}` },
    { decimals: 18 },
    { asset: 'USDC' },
    { currency: 'USD' },
    { address: 'invalid' },
])('rejects an invalid EURC descriptor before reading any chain: %j', async (override) => {
    await expect(
        eurcBalanceQueryOptions('alice', { ...eurc, ...override } as CurrencyAccount).queryFn()
    ).rejects.toThrow('Unsupported EURC account')
    expect(getPublicClient).not.toHaveBeenCalled()
})
