import { act, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { APP_LOCALES } from '@/i18n/app/config'
import { loadMessages } from '@/i18n/app/messages'
import { renderWithIntl } from '@/test-utils/intl'
import {
    closeBrazilPausedDrawer,
    isBrazilPausedDrawerOpen,
    openBrazilPausedDrawer,
} from '../brazil-paused-drawer-store'
import { BrazilPausedDrawer } from '../components/BrazilPausedDrawer'

afterEach(() => act(() => closeBrazilPausedDrawer()))

describe('BrazilPausedDrawer', () => {
    it('stays shut until a Brazil entry opens it', () => {
        renderWithIntl(<BrazilPausedDrawer />)
        expect(screen.queryByTestId('brazil-paused-drawer')).not.toBeInTheDocument()
    })

    it.each(APP_LOCALES)('explains the pause in %s and closes on Got it', async (locale) => {
        const messages = await loadMessages(locale)
        render(
            <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                <BrazilPausedDrawer />
            </NextIntlClientProvider>
        )
        act(() => openBrazilPausedDrawer())

        expect(screen.getByText(messages.brazilPause.title)).toBeInTheDocument()
        expect(screen.getByText(messages.brazilPause.body)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: messages.common.gotIt }))
        expect(isBrazilPausedDrawerOpen()).toBe(false)
    })
})
