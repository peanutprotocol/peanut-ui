import { renderHook } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import ptMessages from '@/i18n/app/messages/pt-BR.json'
import { ACTION_METHODS } from '@/constants/actionlist.consts'
import { usePaymentMethodLabels } from '../usePaymentMethodLabels'

const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="pt-BR" messages={ptMessages}>
        {children}
    </NextIntlClientProvider>
)

describe('usePaymentMethodLabels', () => {
    // a pt-BR payer read "Exchange or Wallet" and "Instant transfers" among translated rows
    it('names every listed method in the reader language', () => {
        const { result } = renderHook(() => usePaymentMethodLabels(), { wrapper })
        const labels = Object.fromEntries(ACTION_METHODS.map((method) => [method.id, result.current(method)]))

        expect(labels.bank).toEqual({ title: 'Transferência bancária', description: 'EUR, USD, MXN, ARS e mais' })
        expect(labels['exchange-or-wallet'].title).toBe(ptMessages.send.methods.exchangeOrWalletTitle)
        // brand names stay; their description does not
        expect(labels.pix.title).toBe('Pix')
        expect(labels.pix.description).toBe(ptMessages.send.methods.instantTransfers)
        for (const label of Object.values(labels)) {
            expect(label.description).not.toMatch(/Instant transfers|and more|& more/)
        }
    })

    it('keeps the constant for a method the catalogue does not name', () => {
        const { result } = renderHook(() => usePaymentMethodLabels(), { wrapper })
        const devconnect = { id: 'devconnect', title: 'Devconnect', description: 'Claim to your Devconnect wallet' }
        expect(result.current(devconnect)).toEqual({ title: 'Devconnect', description: devconnect.description })
    })
})
