import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import { ActiveIssueDrawer } from '../components/ActiveIssueDrawer'
import { AddMoneyHelpDrawer } from '../components/AddMoneyHelpDrawer'
import { HomeFundedDrawer } from '../components/HomeFundedDrawer'
import { VerifyRepeatErrorCallout } from '../components/VerifyRepeatErrorCallout'

jest.mock('@/components/Global/Drawer', () => ({
    Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
    DrawerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DrawerDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

function wrap(ui: React.ReactNode) {
    return render(
        <NextIntlClientProvider locale="en" messages={en}>
            {ui}
        </NextIntlClientProvider>
    )
}

describe('Stuck intervention drawers', () => {
    it('renders deposit troubleshooting and copies context before opening support', () => {
        const onContactSupport = jest.fn()
        const onClose = jest.fn()
        wrap(<AddMoneyHelpDrawer open onClose={onClose} onContactSupport={onContactSupport} />)

        expect(screen.getByText('Deposit troubleshooting')).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('stuck-drawer-primary'))
        expect(onContactSupport).toHaveBeenCalledWith(
            'Bank transfer deposit help',
            'Need help with a bank transfer deposit in Peanut.'
        )
        expect(onClose).toHaveBeenCalled()
    })

    it('renders first-payment options on home_funded and routes cleanly', () => {
        const onNavigate = jest.fn()
        wrap(<HomeFundedDrawer open onClose={jest.fn()} onNavigate={onNavigate} onContactSupport={jest.fn()} />)

        fireEvent.click(screen.getByTestId('stuck-drawer-qr'))
        expect(onNavigate).toHaveBeenCalledWith('/qr-pay')
    })

    it('submits a 1-tap bug report with category and note and shows confirmation', () => {
        const onSubmitBugReport = jest.fn()
        wrap(
            <ActiveIssueDrawer
                open
                onClose={jest.fn()}
                onContactSupport={jest.fn()}
                onSubmitBugReport={onSubmitBugReport}
            />
        )

        fireEvent.click(screen.getByTestId('bug-chip-screen_stuck'))
        fireEvent.change(screen.getByLabelText('Optional note'), { target: { value: 'Coffee shop QR' } })
        fireEvent.click(screen.getByTestId('stuck-bug-submit'))

        expect(onSubmitBugReport).toHaveBeenCalledWith('screen_stuck', 'Coffee shop QR')
        expect(screen.getByText('Bug report sent')).toBeInTheDocument()
    })

    it('renders field-specific hints for phone vs taxId repeat errors', () => {
        const { rerender } = wrap(<VerifyRepeatErrorCallout fieldKey="taxId" fieldKind="taxId" />)
        expect(screen.getByText('Enter digits only, no spaces or dashes.')).toBeInTheDocument()

        rerender(
            <NextIntlClientProvider locale="en" messages={en}>
                <VerifyRepeatErrorCallout fieldKey="phone" fieldKind="phone" />
            </NextIntlClientProvider>
        )
        expect(screen.getByText('Include the country code starting with +.')).toBeInTheDocument()

        rerender(
            <NextIntlClientProvider locale="en" messages={en}>
                <VerifyRepeatErrorCallout fieldKey="street" fieldKind="other" />
            </NextIntlClientProvider>
        )
        expect(screen.getByText('Check the format or contact support.')).toBeInTheDocument()
    })
})
