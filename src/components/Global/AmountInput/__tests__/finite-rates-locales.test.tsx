import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import AmountInput from '..'
import en from '@/i18n/app/messages/en.json'
import es419 from '@/i18n/app/messages/es-419.json'
import esAR from '@/i18n/app/messages/es-AR.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'

jest.mock('@/utils/sentry-lazy', () => ({ captureMessage: jest.fn() }))

// Argentina ships an overlay catalog; combine it with its Spanish base without
// mocking any translated text or production conversion behavior.
function overlay(base: Record<string, unknown>, changes: Record<string, unknown>): Record<string, unknown> {
    const result = { ...base }
    for (const [key, value] of Object.entries(changes)) {
        const previous = result[key]
        result[key] =
            value && typeof value === 'object' && previous && typeof previous === 'object'
                ? overlay(previous as Record<string, unknown>, value as Record<string, unknown>)
                : value
    }
    return result
}

const locales = [
    { locale: 'en', messages: en },
    { locale: 'es-419', messages: es419 },
    { locale: 'es-AR', messages: overlay(es419, esAR) as typeof en },
    { locale: 'pt-BR', messages: ptBR },
] as const

function expectFinitePresentation(container: HTMLElement, ...callbacks: jest.Mock[]) {
    expect(container.textContent).not.toMatch(/NaN|Infinity|∞/)
    for (const field of container.querySelectorAll('input')) expect(field.value).not.toMatch(/NaN|Infinity|∞/)
    for (const slider of container.querySelectorAll('[role="slider"]')) {
        for (const attribute of ['aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-valuetext']) {
            expect(slider.getAttribute(attribute) ?? '').not.toMatch(/NaN|Infinity|∞/)
        }
    }
    for (const callback of callbacks) {
        for (const [value] of callback.mock.calls) {
            expect(value === '' || Number.isFinite(Number(value))).toBe(true)
        }
    }
}

describe.each(locales)('AmountInput finite conversions in $locale', ({ locale, messages }) => {
    const invalidRates = [undefined, 0, -1, NaN, Infinity, -Infinity]
    it.each(invalidRates.map((rate, index) => ({ rate, index })))(
        'keeps typed primary money unavailable until secondary rate recovers, case $index',
        ({ rate }) => {
            const primary = jest.fn()
            const secondary = jest.fn()
            const view = (price: number | undefined) => (
                <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                    <AmountInput
                        initialAmount="4000"
                        primaryDenomination={{ symbol: 'BRL', price: 1, decimals: 2 }}
                        secondaryDenomination={{ symbol: 'USD', price: price as number, decimals: 2 }}
                        setPrimaryAmount={primary}
                        setSecondaryAmount={secondary}
                        hideCurrencyToggle={false}
                    />
                </NextIntlClientProvider>
            )
            const { container, rerender } = render(view(rate))
            const field = screen.getByRole('textbox') as HTMLInputElement
            expect(Number(field.value)).toBe(4000)
            fireEvent.change(field, { target: { value: '4001' } })
            expect(Number(field.value)).toBe(4001)
            expect(container.textContent).toContain('—')
            expect(secondary).toHaveBeenLastCalledWith('')
            expect(secondary.mock.calls.every(([value]) => value === '')).toBe(true)
            expectFinitePresentation(container, primary, secondary)
            rerender(view(1))
            expect(Number(field.value)).toBe(4001)
            expect(Number(secondary.mock.lastCall?.[0])).toBe(4001)
            expectFinitePresentation(container, primary, secondary)
        }
    )

    it.each(invalidRates.map((rate, index) => ({ rate, index })))(
        'does not promote an unavailable conversion into spendable primary money after toggle, case $index',
        ({ rate }) => {
            const primary = jest.fn()
            const secondary = jest.fn()
            const { container } = render(
                <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                    <AmountInput
                        initialAmount="4000"
                        primaryDenomination={{ symbol: 'BRL', price: rate as number, decimals: 2 }}
                        secondaryDenomination={{ symbol: 'USD', price: 1, decimals: 2 }}
                        setPrimaryAmount={primary}
                        setSecondaryAmount={secondary}
                        hideCurrencyToggle={false}
                    />
                </NextIntlClientProvider>
            )
            expect(container.textContent).toContain('—')
            expect(secondary).toHaveBeenLastCalledWith('')
            primary.mockClear()
            secondary.mockClear()
            fireEvent.click(screen.getByRole('button', { name: /switch currency|cambiar moneda|trocar moeda/i }))
            const field = screen.getByRole('textbox') as HTMLInputElement
            // A disabled toggle may keep the original amount; an enabled toggle may
            // clear it. Neither may silently mint a different converted spend.
            for (const [value] of primary.mock.calls) expect(value === '' || Number(value) === 4000).toBe(true)
            expect(field.value === '' || Number(field.value) === 4000).toBe(true)
            expectFinitePresentation(container, primary, secondary)
        }
    )
})
