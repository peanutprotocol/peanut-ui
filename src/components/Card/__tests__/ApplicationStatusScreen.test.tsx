/**
 * ApplicationStatusScreen — rejected-card copy contract.
 *
 * The rejected variant must (1) surface the specific, vetted reason from the
 * capability read-model when present (e.g. "…available in your state yet."),
 * (2) always reassure the user that the rest of Peanut still works, and
 * (3) keep the Contact-support path. The reason line is optional — older
 * rejections without a persisted reason fall back to the body alone.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ApplicationStatusScreen from '@/components/Card/ApplicationStatusScreen'

// NavHeader reads useAuth; stub it so the presentational screen renders alone.
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { accounts: [] }, fetchUser: jest.fn() }),
}))
// next/image → plain img so jsdom doesn't choke on the optimizer.
jest.mock('next/image', () => ({
    __esModule: true,
    // eslint-disable-next-line @next/next/no-img-element -- test stub, not real markup
    default: (props: Record<string, unknown>) => <img alt={String(props.alt ?? '')} />,
}))

const REASSURANCE = 'You can still use Peanut freely to deposit, withdraw, and pay with crypto.'

describe('ApplicationStatusScreen — rejected', () => {
    it('renders the specific reason above the reassurance body', () => {
        render(
            <ApplicationStatusScreen
                variant="rejected"
                reasonMessage="Peanut cards aren't available in your state yet."
                onContactSupport={jest.fn()}
            />
        )
        expect(screen.getByText("We couldn't issue you a card")).toBeInTheDocument()
        expect(screen.getByText("Peanut cards aren't available in your state yet.")).toBeInTheDocument()
        expect(screen.getByText(REASSURANCE)).toBeInTheDocument()
    })

    it('falls back to the reassurance body alone when no reason is provided', () => {
        render(<ApplicationStatusScreen variant="rejected" onContactSupport={jest.fn()} />)
        expect(screen.getByText(REASSURANCE)).toBeInTheDocument()
        // No phantom reason paragraph — only the generic body shows.
        expect(screen.queryByText(/available in your/i)).not.toBeInTheDocument()
    })

    it('keeps the Contact support action', () => {
        const onContactSupport = jest.fn()
        render(<ApplicationStatusScreen variant="rejected" onContactSupport={onContactSupport} />)
        fireEvent.click(screen.getByText('Contact support'))
        expect(onContactSupport).toHaveBeenCalledTimes(1)
    })
})
