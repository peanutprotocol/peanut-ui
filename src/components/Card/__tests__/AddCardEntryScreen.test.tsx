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
