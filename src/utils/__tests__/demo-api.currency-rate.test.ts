/** @jest-environment node */
import { demoRespond } from '@/utils/demo-api'
import type { CurrencyExchangeRate } from '@/services/currency-accounts'

jest.mock('@/app/actions/clients', () => ({}))

it.each(['EURC', 'USDC'])('supplies the directional-rate contract for synthetic %s pricing offline', async (from) => {
    const response = await demoRespond(
        `/users/currency-accounts/EURC/exchange-rate?from=${from}`,
        { method: 'GET' },
        { offline: true, strict: true }
    )
    const rate: CurrencyExchangeRate = await response.json()
    expect(response.status).toBe(200)
    expect(rate).toMatchObject({ midmarket_rate: '1.1', buy_rate: '1.1', sell_rate: '1.1', indicative: true })
    expect(Number.isFinite(Date.parse(rate.updated_at))).toBe(true)
    expect(rate.developerFeePercent).toBe('0')
})
