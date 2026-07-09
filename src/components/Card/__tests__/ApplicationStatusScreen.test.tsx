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
        const reason = screen.getByText("Peanut cards aren't available in your state yet.")
        const body = screen.getByText(REASSURANCE)
        // Contract: the specific reason renders ABOVE the reassurance body.
        expect(reason.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        // Both paragraphs live in the same copy block (reason + body).
        expect(body.parentElement?.querySelectorAll('p')).toHaveLength(2)
    })

    it('falls back to the reassurance body alone when no reason is provided', () => {
        render(<ApplicationStatusScreen variant="rejected" onContactSupport={jest.fn()} />)
        const body = screen.getByText(REASSURANCE)
        expect(body).toBeInTheDocument()
        // No phantom reason paragraph — the copy block holds only the body <p>.
        expect(body.parentElement?.querySelectorAll('p')).toHaveLength(1)
    })

    it('keeps the Contact support action', () => {
        const onContactSupport = jest.fn()
        render(<ApplicationStatusScreen variant="rejected" onContactSupport={onContactSupport} />)
        fireEvent.click(screen.getByText('Contact support'))
        expect(onContactSupport).toHaveBeenCalledTimes(1)
    })
})

describe('ApplicationStatusScreen — geo-blocked', () => {
    it('renders the regional copy with the reassurance', () => {
        render(<ApplicationStatusScreen variant="geo-blocked" />)
        expect(screen.getByText("Cards aren't available in your region yet")).toBeInTheDocument()
        expect(screen.getByText(/regulatory restrictions.*deposit, withdraw, and pay with crypto/)).toBeInTheDocument()
    })

    it('never renders a Contact-support CTA — regulation is not a support case', () => {
        // Even if a caller wires the handler, geo-blocked must not show the
        // CTA: support cannot override Rain's prohibited-issuance list, so the
        // button would be a dead end by design. Guards SUPPORT_VARIANTS drift.
        render(<ApplicationStatusScreen variant="geo-blocked" onContactSupport={jest.fn()} />)
        expect(screen.queryByText('Contact support')).not.toBeInTheDocument()
    })

    it('links the Prohibited Activities Policy — the one compliant place the country list is published', () => {
        render(<ApplicationStatusScreen variant="geo-blocked" />)
        const link = screen.getByRole('link', { name: 'See which regions are restricted' })
        expect(link).toHaveAttribute('href', 'https://peanut.me/en/card-prohibited-activities')
        expect(link).toHaveAttribute('target', '_blank')
    })

    it('does not show the policy link on other variants', () => {
        render(<ApplicationStatusScreen variant="rejected" onContactSupport={jest.fn()} />)
        expect(screen.queryByText('See which regions are restricted')).not.toBeInTheDocument()
    })
})
