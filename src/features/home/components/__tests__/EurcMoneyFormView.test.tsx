import React from 'react'
import { randomUUID } from 'node:crypto'
Object.defineProperty(globalThis.crypto, 'randomUUID', { value: randomUUID, configurable: true })
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EurcMoneyFormView } from '../EurcMoneyFormView'
import { currencyAccountsApi, type CurrencyOperationKind } from '@/services/currency-accounts'
jest.mock('@/services/currency-accounts', () => ({
    currencyAccountsApi: { prepare: jest.fn(), bankAccounts: jest.fn(), exchangeRate: jest.fn() },
}))
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('../EurcBankAccountView', () => ({ EurcBankAccountView: () => <div>bank form</div> }))
jest.mock('@/components/0_Bruddle/BaseSelect', () => ({
    BaseSelect: ({ options, onValueChange, ...props }: any) => (
        <select {...props} onChange={(e) => onValueChange(e.target.value)}>
            <option value="" />
            {options.map((o: any) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    ),
}))
function setup(kind: CurrencyOperationKind) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const prepared = jest.fn()
    const view = render(
        <QueryClientProvider client={client}>
            <EurcMoneyFormView userId="alice" kind={kind} onPrepared={prepared} onClose={() => {}} />
        </QueryClientProvider>
    )
    return { client, prepared, ...view }
}
beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(currencyAccountsApi.bankAccounts).mockResolvedValue({ accounts: [{ id: 'bank', label: 'Euro bank' }] })
    jest.mocked(currencyAccountsApi.exchangeRate).mockResolvedValue({ midmarket_rate: '1.1', indicative: true })
    jest.mocked(currencyAccountsApi.prepare).mockRejectedValue(new Error('lost response'))
})
it('keeps the idempotency key for retries and replaces it when a failed request is edited', async () => {
    const { client } = setup('SEND')
    fireEvent.change(screen.getByLabelText(/amount/), { target: { value: '1.000001' } })
    fireEvent.change(screen.getByLabelText('recipient'), { target: { value: `0x${'22'.repeat(20)}` } })
    fireEvent.click(screen.getByRole('button', { name: 'review' }))
    await screen.findByRole('alert')
    const first = jest.mocked(currencyAccountsApi.prepare).mock.calls[0][0]
    fireEvent.click(screen.getByRole('button', { name: 'review' }))
    await waitFor(() => expect(currencyAccountsApi.prepare).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('button', { name: 'review' })).toBeEnabled())
    expect(jest.mocked(currencyAccountsApi.prepare).mock.calls[1][0].requestKey).toBe(first.requestKey)
    fireEvent.change(screen.getByLabelText(/amount/), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'review' }))
    await waitFor(() => expect(currencyAccountsApi.prepare).toHaveBeenCalledTimes(3))
    expect(jest.mocked(currencyAccountsApi.prepare).mock.calls[2][0].requestKey).not.toBe(first.requestKey)
    client.clear()
})
it('rejects fractional cents for bank funding and excess token precision', () => {
    const { client } = setup('BANK_DEPOSIT')
    for (const amount of ['0', '1.000001', '1.1234567', '1e3']) {
        fireEvent.change(screen.getByLabelText(/amount/), { target: { value: amount } })
        expect(screen.getByRole('button', { name: 'review' })).toBeDisabled()
    }
    fireEvent.change(screen.getByLabelText(/amount/), { target: { value: '1.23' } })
    expect(screen.getByRole('button', { name: 'review' })).toBeEnabled()
    client.clear()
})
it('requires an owned bank selection before preparing a withdrawal', async () => {
    const { client } = setup('BANK_WITHDRAW')
    await screen.findByRole('option', { name: 'Euro bank' })
    fireEvent.change(screen.getByLabelText(/amount/), { target: { value: '1' } })
    expect(screen.getByRole('button', { name: 'review' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('bankAccount'), { target: { value: 'bank' } })
    fireEvent.click(screen.getByRole('button', { name: 'review' }))
    await screen.findByRole('alert')
    expect(currencyAccountsApi.prepare).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'BANK_WITHDRAW', externalAccountId: 'bank', sourceAsset: 'EURC' })
    )
    client.clear()
})
it('labels exchange prices as indicative and prepares the selected USDC source', async () => {
    const { client } = setup('EXCHANGE')
    await screen.findByText(/referenceRate/)
    fireEvent.change(screen.getByLabelText('from'), { target: { value: 'USDC' } })
    fireEvent.change(screen.getByLabelText(/amount/), { target: { value: '1.000001' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'review' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'review' }))
    await screen.findByRole('alert')
    expect(currencyAccountsApi.prepare).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'EXCHANGE', sourceAsset: 'USDC', amount: '1.000001' })
    )
    client.clear()
})
