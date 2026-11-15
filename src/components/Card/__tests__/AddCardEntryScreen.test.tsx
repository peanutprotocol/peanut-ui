import { act, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { loadMessages } from '@/i18n/app/messages'
import AddCardEntryScreen from '../AddCardEntryScreen'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Card/share-asset/ScaledPixelatedCardFace', () => ({ ScaledPixelatedCardFace: () => null }))

it.each(['en', 'es-419', 'es-AR', 'pt-BR'] as const)(
    'explains the $10 minimum and labels the funding CTA in %s',
    async (locale) => {
        const messages = await loadMessages(locale)
        const apply = jest.fn()
        const { rerender } = render(
            <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                <AddCardEntryScreen onApply={apply} needsFundingBeforeApply />
            </NextIntlClientProvider>
        )
        expect(screen.getByText(messages.card.onboarding.fundingBody)).toBeInTheDocument()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: messages.addMoney.title }))
        })
        expect(apply).toHaveBeenCalledTimes(1)
        rerender(
            <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                <AddCardEntryScreen onApply={apply} />
            </NextIntlClientProvider>
        )
        expect(screen.queryByText(messages.card.onboarding.fundingBody)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: messages.card.entry.cta })).toBeInTheDocument()
    }
)

describe('phone wallet', () => {
    const originalUserAgent = navigator.userAgent
    const setUserAgent = (userAgent: string) =>
        Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent })

    afterEach(() => setUserAgent(originalUserAgent))

    it.each([
        [
            'Apple Pay on iOS',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
            'Contactless with Apple Pay',
            '/wallet/apple/apple-pay-logo.svg',
        ],
        [
            'Google Pay on Android',
            'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
            'Contactless with Google Pay',
            '/wallet/google/google-pay-logo.svg',
        ],
        [
            'both wallets on desktop',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
            'Contactless with Apple Pay or Google Pay',
            null,
        ],
    ])('shows %s', async (_name, userAgent, label, logo) => {
        setUserAgent(userAgent)
        const { container } = render(
            <NextIntlClientProvider locale="en" messages={await loadMessages('en')} timeZone="UTC">
                <AddCardEntryScreen onApply={jest.fn()} />
            </NextIntlClientProvider>
        )
        expect(screen.getByText(label)).toBeInTheDocument()
        const wallet = container.querySelector('img[src*="/wallet/"]')
        if (logo) expect(wallet?.getAttribute('src')).toBe(logo)
        else expect(wallet).toBeNull()
    })
})
