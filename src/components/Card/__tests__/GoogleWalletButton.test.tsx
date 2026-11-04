import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import GoogleWalletButton from '@/components/Card/GoogleWalletButton'
import { APP_LOCALES } from '@/i18n/app/config'
import { loadMessages } from '@/i18n/app/messages'

const mockHaptic = jest.fn()
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: mockHaptic }) }))
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
    const file = locale === 'es-AR' ? 'es-419' : locale
    const images = Array.from(button.querySelectorAll('img'))
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
        `/wallet/google/one-line/${file}.svg`,
        `/wallet/google/two-line/${file}.svg`,
    ])
    images.forEach((image) => expect(image).toHaveAttribute('alt', ''))
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

it('shifts 1px down-right while pressed and holds there while the add runs', async () => {
    const messages = await loadMessages('en')
    const onClick = jest.fn()
    const renderButton = (isAdding: boolean) => (
        <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
            <GoogleWalletButton isAdding={isAdding} onClick={onClick} />
        </NextIntlClientProvider>
    )
    mockHaptic.mockClear()
    const { rerender } = render(renderButton(false))
    const button = screen.getByRole('button', { name: messages.card.yourCard.addToGoogleWallet })
    const classes = button.className.split(' ')
    expect(classes).toEqual(
        expect.arrayContaining([
            'active:translate-x-px',
            'active:translate-y-px',
            'aria-busy:translate-x-px',
            'aria-busy:translate-y-px',
        ])
    )
    // The artwork itself is never moved, scaled or recoloured.
    button.querySelectorAll('img').forEach((image) => expect(image.className).not.toMatch(/translate|scale|opacity/))

    fireEvent.click(button)
    expect(mockHaptic).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(renderButton(true))
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(mockHaptic).toHaveBeenCalledTimes(1)
})
