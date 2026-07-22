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
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import ApplicationStatusScreen from '@/components/Card/ApplicationStatusScreen'

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
// next/image → plain img so jsdom doesn't choke on the optimizer.
jest.mock('next/image', () => ({
    __esModule: true,
    // eslint-disable-next-line @next/next/no-img-element -- test stub, not real markup
    default: (props: Record<string, unknown>) => <img alt={String(props.alt ?? '')} />,
}))

const REASSURANCE = en.card.status.rejectedBody

describe('ApplicationStatusScreen — rejected', () => {
    it('renders the specific reason above the reassurance body', () => {
        render(
            <ApplicationStatusScreen
                variant="rejected"
                reasonMessage="Peanut cards aren't available in your state yet."
                onContactSupport={jest.fn()}
            />
        )
        expect(screen.getByText(en.card.status.rejectedTitle)).toBeInTheDocument()
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

describe('ApplicationStatusScreen — proof-of-address upload CTA', () => {
    it('renders the upload CTA as primary when the rail carries a PoA action', () => {
        const onUpload = jest.fn()
        render(
            <ApplicationStatusScreen
                variant="requires-info"
                reasonMessage="We need a valid proof of address document."
                onContactSupport={jest.fn()}
                onUploadProofOfAddress={onUpload}
            />
        )
        fireEvent.click(screen.getByText('Upload proof of address'))
        expect(onUpload).toHaveBeenCalledTimes(1)
        // Contact support stays available as the fallback path.
        expect(screen.getByText('Contact support')).toBeInTheDocument()
    })

    it('renders the upload CTA on the rejected variant too (denied + fixable PoA)', () => {
        render(
            <ApplicationStatusScreen
                variant="rejected"
                onContactSupport={jest.fn()}
                onUploadProofOfAddress={jest.fn()}
            />
        )
        expect(screen.getByText('Upload proof of address')).toBeInTheDocument()
    })

    it('omits the upload CTA when no PoA action exists', () => {
        render(<ApplicationStatusScreen variant="requires-info" onContactSupport={jest.fn()} />)
        expect(screen.queryByText('Upload proof of address')).not.toBeInTheDocument()
    })

    it('never renders the upload CTA on non-support variants', () => {
        render(<ApplicationStatusScreen variant="pending" onUploadProofOfAddress={jest.fn()} />)
        expect(screen.queryByText('Upload proof of address')).not.toBeInTheDocument()
    })
})

describe('ApplicationStatusScreen — upload error', () => {
    it('renders the inline error under the upload CTA', () => {
        render(
            <ApplicationStatusScreen
                variant="requires-info"
                onContactSupport={jest.fn()}
                onUploadProofOfAddress={jest.fn()}
                uploadError="Could not start the upload. Please try again."
            />
        )
        expect(screen.getByText('Could not start the upload. Please try again.')).toBeInTheDocument()
    })
})
