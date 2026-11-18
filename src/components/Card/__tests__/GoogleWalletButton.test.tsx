import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    // Never below Google's 48dp minimum: the two-line badge at 56px until the one-line artwork fits at 48px
    const classes = button.className.split(' ')
    expect(classes).toContain('h-14')
    expect(classes.some((name) => /^@min-\[\d+px\]:h-12$/.test(name))).toBe(true)
    images.forEach((image) => expect(image.className).toMatch(/\bh-full\b/))
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

it('darkens the fill while pressed and while the add runs, without moving the button', async () => {
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
            'active:bg-background-google-wallet-press',
            'aria-busy:bg-background-google-wallet-press',
        ])
    )
    // Shadowless, so it never translates on press (design.md law 7).
    expect(button.className).not.toMatch(/translate/)
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

describe('touch ripple', () => {
    const renderEn = async (isAdding = false) => {
        const messages = await loadMessages('en')
        render(
            <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
                <GoogleWalletButton isAdding={isAdding} onClick={jest.fn()} />
            </NextIntlClientProvider>
        )
        return screen.getByRole('button', { name: messages.card.yourCard.addToGoogleWallet })
    }
    const animate = jest.fn(() => ({ finished: Promise.resolve() }))

    beforeEach(() => {
        animate.mockClear()
        Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true })
    })
    afterEach(() => {
        delete (HTMLElement.prototype as Partial<HTMLElement>).animate
    })

    it('spreads under the artwork from the touch point and clears after release', async () => {
        const button = await renderEn()
        fireEvent.pointerDown(button, { button: 0, clientX: 10, clientY: 10 })
        const wave = button.querySelector('span[aria-hidden] > span')
        expect(wave).not.toBeNull()
        expect(animate).toHaveBeenCalledTimes(1)
        button.querySelectorAll('img').forEach((image) => expect(image.className).toMatch(/\brelative\b/))

        fireEvent.pointerUp(button)
        fireEvent.pointerLeave(button)
        await waitFor(() => expect(button.querySelector('span[aria-hidden] > span')).toBeNull())
        // grow, then one fade even though up and leave both fired
        expect(animate).toHaveBeenCalledTimes(2)
    })

    it('does not ripple while the add runs', async () => {
        const button = await renderEn(true)
        fireEvent.pointerDown(button, { button: 0 })
        expect(animate).not.toHaveBeenCalled()
    })
})
