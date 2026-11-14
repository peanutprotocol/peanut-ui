import { act, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { APP_LOCALES } from '@/i18n/app/config'
import { loadMessages } from '@/i18n/app/messages'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import {
    closeBrazilPausedDrawer,
    isBrazilPausedDrawerOpen,
    openBrazilPausedDrawer,
} from '../brazil-paused-drawer-store'
import { BrazilPausedDrawer } from '../components/BrazilPausedDrawer'

// the user's Pix withdraw route, which says whether a Pix key can still be paid
let mockWithdrawState: string | null = null
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        capabilities: {
            routes: mockWithdrawState ? [{ operation: 'withdraw', method: 'PIX_BR', state: mockWithdrawState }] : [],
        },
    }),
}))

afterEach(() => {
    act(() => closeBrazilPausedDrawer())
    mockWithdrawState = null
})

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
        act(() => openBrazilPausedDrawer('paused'))

        expect(screen.getByText(messages.brazilPause.title)).toBeInTheDocument()
        expect(screen.getByText(messages.brazilPause.body)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: messages.common.gotIt }))
        expect(isBrazilPausedDrawerOpen()).toBe(false)
    })

    // the pay:PIX_BR route refuses the residence: one sentence, no claim that deposits are down
    it.each(APP_LOCALES)('says Pix payments do not serve the residence yet in %s', async (locale) => {
        const messages = await loadMessages(locale)
        render(
            <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                <BrazilPausedDrawer />
            </NextIntlClientProvider>
        )
        act(() => openBrazilPausedDrawer('residence'))

        expect(screen.getByText(messages.pix.unavailableTitle)).toBeInTheDocument()
        expect(screen.getByText(messages.pix.payResidence)).toBeInTheDocument()
        expect(screen.queryByText(messages.brazilPause.body)).not.toBeInTheDocument()
        expect(screen.queryByText(messages.pix.payResidenceKeySend)).not.toBeInTheDocument()
    })

    // a resident whose Pix payouts are ready pays a Pix key through them (TASK-24910)
    it.each(APP_LOCALES)('adds that a Pix key can still be paid once Pix payouts are ready, in %s', async (locale) => {
        mockWithdrawState = 'ready'
        const messages = await loadMessages(locale)
        render(
            <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                <BrazilPausedDrawer />
            </NextIntlClientProvider>
        )
        act(() => openBrazilPausedDrawer('residence'))

        expect(screen.getByText(messages.pix.payResidence)).toBeInTheDocument()
        expect(screen.getByText(messages.pix.payResidenceKeySend)).toBeInTheDocument()
    })

    it.each(['pending', 'action_required', 'refused'])(
        'says nothing of a Pix key while the withdraw route is %s',
        (state) => {
            mockWithdrawState = state
            renderWithIntl(<BrazilPausedDrawer />)
            act(() => openBrazilPausedDrawer('residence'))

            expect(screen.getByText(en.pix.payResidence)).toBeInTheDocument()
            expect(screen.queryByText(en.pix.payResidenceKeySend)).not.toBeInTheDocument()
        }
    )

    it('says nothing of a Pix key during the Brazil pause, ready payouts or not', () => {
        mockWithdrawState = 'ready'
        renderWithIntl(<BrazilPausedDrawer />)
        act(() => openBrazilPausedDrawer('paused'))

        expect(screen.getByText(en.brazilPause.body)).toBeInTheDocument()
        expect(screen.queryByText(en.pix.payResidenceKeySend)).not.toBeInTheDocument()
    })
})
