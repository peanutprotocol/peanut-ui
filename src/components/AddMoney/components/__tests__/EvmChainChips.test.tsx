import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { APP_LOCALES } from '@/i18n/app/config'
import { loadMessages } from '@/i18n/app/messages'
import EvmChainChips from '../EvmChainChips'

it.each(APP_LOCALES)('identifies the accepted EURe variant in the %s network list', async (locale) => {
    render(
        <NextIntlClientProvider locale={locale} messages={await loadMessages(locale)} timeZone="UTC">
            <EvmChainChips />
        </NextIntlClientProvider>
    )

    expect(screen.getByText(/GNOSIS.*EURe v2/)).toBeVisible()
    expect(screen.queryByText(/EURe(?! v2)/)).not.toBeInTheDocument()
})
