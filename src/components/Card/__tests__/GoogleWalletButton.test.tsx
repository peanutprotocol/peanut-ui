import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import GoogleWalletButton from '@/components/Card/GoogleWalletButton'
import { APP_LOCALES } from '@/i18n/app/config'
import { loadMessages } from '@/i18n/app/messages'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({
        unoptimized: _unoptimized,
        ...props
    }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => <img {...props} />,
}))

it.each(APP_LOCALES)('uses official artwork and a matching accessible label in %s', async (locale) => {
    const messages = await loadMessages(locale)
    const onClick = jest.fn()
    const { rerender } = render(
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
            <GoogleWalletButton isAdding={false} onClick={onClick} />
        </NextIntlClientProvider>
    )
    const button = screen.getByRole('button', { name: messages.card.yourCard.addToGoogleWallet })
    const image = button.querySelector('img')
    expect(image).toHaveAttribute('src', `/wallet/google/${locale === 'es-AR' ? 'es-419' : locale}.svg`)
    expect(image).toHaveAttribute('alt', '')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
            <GoogleWalletButton isAdding onClick={onClick} />
        </NextIntlClientProvider>
    )
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(messages.card.yourCard.addedToGoogleWallet).toBeTruthy()
})
