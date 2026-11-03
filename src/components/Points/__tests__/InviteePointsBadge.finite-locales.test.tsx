import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import InviteePointsBadge from '../InviteePointsBadge'
import en from '@/i18n/app/messages/en.json'
import es419 from '@/i18n/app/messages/es-419.json'
import esAr from '@/i18n/app/messages/es-AR.json'
import ptBr from '@/i18n/app/messages/pt-BR.json'

// Keep animation deterministic; render the actual badge and shared formatters.
jest.mock('@/hooks/useCountUp', () => ({ useCountUp: (target: number) => target }))

const locales = [
    ['en', en],
    ['es-419', es419],
    ['es-AR', { ...es419, rewards: { ...es419.rewards, ...esAr.rewards } }],
    ['pt-BR', ptBr],
] as const

describe.each(locales)('finite reward amounts in %s', (locale, messages) => {
    const badge = (points: number, lifetimeEarnedUsd: number) =>
        render(
            <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                <InviteePointsBadge points={points} lifetimeEarnedUsd={lifetimeEarnedUsd} inView={false} />
            </NextIntlClientProvider>
        )

    test('preserves the intended 4000 dollar amount and points units', () => {
        const { container } = badge(4000, 4000)
        expect(screen.getByText('$4000.00')).toBeInTheDocument()
        expect(container.textContent).toContain('4,000')
        expect(container.textContent).not.toMatch(/NaN|Infinity|undefined|∞/)
    })

    test.each([NaN, Infinity, -Infinity])('invalid %s is unavailable, never a fake zero', (amount) => {
        const { container } = badge(amount, amount)
        expect(container.textContent).toContain('—')
        expect(container.textContent).not.toMatch(/NaN|Infinity|undefined|∞|\$0(?:\.00)?/)
    })
})
