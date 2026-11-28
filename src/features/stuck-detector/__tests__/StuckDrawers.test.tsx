import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import enMessages from '@/i18n/app/messages/en.json'
import { ActiveIssueDrawer } from '../components/ActiveIssueDrawer'
import { AddMoneyHelpDrawer } from '../components/AddMoneyHelpDrawer'
import { HomeFundedDrawer } from '../components/HomeFundedDrawer'

jest.mock('@/components/Global/Drawer', () => ({
    Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
    DrawerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DrawerDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

const renderWithIntl = (ui: React.ReactElement) =>
    render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
            {ui}
        </NextIntlClientProvider>
    )

describe('Stuck intervention DRY Bruddle drawers', () => {
    it('AddMoneyHelpDrawer passes explicit copyContext when button promises copy + support', () => {
        const onContactSupport = jest.fn()
        const onClose = jest.fn()
        renderWithIntl(<AddMoneyHelpDrawer open onClose={onClose} onContactSupport={onContactSupport} />)

        fireEvent.click(screen.getByTestId('stuck-drawer-primary'))
        expect(onContactSupport).toHaveBeenCalledWith(
            enMessages.stuckBuddy.supportTopics.addMoney,
            enMessages.stuckBuddy.drawers.addMoney.copyMessage
        )
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('HomeFundedDrawer gates QR Pay and Peanut Card CTAs by regional eligibility', () => {
        const onNavigate = jest.fn()
        const onContactSupport = jest.fn()

        // US/EU user: card available, QR pay unavailable -> Card + Send (never QR).
        const { unmount } = renderWithIntl(
            <HomeFundedDrawer
                open
                canUseQrPay={false}
                canUseCard={true}
                onClose={jest.fn()}
                onNavigate={onNavigate}
                onContactSupport={onContactSupport}
            />
        )
        expect(screen.queryByTestId('stuck-drawer-qr')).toBeNull()
        expect(screen.getByTestId('stuck-drawer-card')).toBeTruthy()
        expect(screen.getByTestId('stuck-drawer-send')).toBeTruthy()
        unmount()

        // LATAM user with both enabled -> QR + Card.
        renderWithIntl(
            <HomeFundedDrawer
                open
                canUseQrPay={true}
                canUseCard={true}
                onClose={jest.fn()}
                onNavigate={onNavigate}
                onContactSupport={onContactSupport}
            />
        )
        expect(screen.getByTestId('stuck-drawer-qr')).toBeTruthy()
        expect(screen.getByTestId('stuck-drawer-card')).toBeTruthy()
    })

    it('ActiveIssueDrawer submits category, label, and note to route into in-app support and closes cleanly', () => {
        const onSubmitBugReport = jest.fn()
        const onClose = jest.fn()
        renderWithIntl(<ActiveIssueDrawer open onClose={onClose} onSubmitBugReport={onSubmitBugReport} />)

        fireEvent.click(screen.getByTestId('bug-chip-screen_stuck'))
        fireEvent.change(screen.getByLabelText('Optional note'), { target: { value: 'Stuck on QR screen' } })
        fireEvent.click(screen.getByTestId('stuck-bug-submit'))

        expect(onSubmitBugReport).toHaveBeenCalledWith('screen_stuck', 'Screen stuck', 'Stuck on QR screen')
        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
