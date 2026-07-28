/**
 * CardCountryConfirmScreen — residence-confirmation contract.
 *
 * Shown when the backend detects conflicting residence evidence (Sumsub
 * address country vs ID-document country). Must (1) render human-readable
 * country names for the ISO-2 candidates, (2) keep Continue disabled until a
 * pick is made, (3) pass the picked ISO-2 (not the display name) to
 * onConfirm, and (4) fall back to a contact-support path when the backend
 * couldn't derive any candidates.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import CardCountryConfirmScreen from '@/components/Card/CardCountryConfirmScreen'

const IntlWrapper = ({ children }: { children: React.ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        {children}
    </NextIntlClientProvider>
)
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

// NavHeader reads useAuth; stub it so the presentational screen renders alone.
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { accounts: [] }, fetchUser: jest.fn() }),
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn() },
}))

describe('CardCountryConfirmScreen', () => {
    it('renders candidate country names and disables Continue until a pick', () => {
        render(
            <CardCountryConfirmScreen candidates={['BR', 'AR']} onConfirm={jest.fn()} onContactSupport={jest.fn()} />
        )
        expect(screen.getByText('Brazil')).toBeInTheDocument()
        expect(screen.getByText('Argentina')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    })

    it('passes the picked ISO-2 code to onConfirm', async () => {
        const onConfirm = jest.fn()
        render(
            <CardCountryConfirmScreen candidates={['BR', 'AR']} onConfirm={onConfirm} onContactSupport={jest.fn()} />
        )
        fireEvent.click(screen.getByText('Brazil'))
        const continueBtn = screen.getByRole('button', { name: 'Continue' })
        expect(continueBtn).toBeEnabled()
        fireEvent.click(continueBtn)
        await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('BR'))
    })

    it('routes to support when no candidates could be derived', () => {
        const onContactSupport = jest.fn()
        render(<CardCountryConfirmScreen candidates={[]} onConfirm={jest.fn()} onContactSupport={onContactSupport} />)
        fireEvent.click(screen.getByText('Contact support'))
        expect(onContactSupport).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
    })
})
