/**
 * The residence choke point. Every gate that opens this modal unlocks a bank
 * rail, and pre-KYC none of them can tell that the user's residence rules bank
 * rails out — there is no rail to carry `uk_resident_blocked` and no rejection
 * to set `isRegionRestricted`. Without the check here they all offer an ID
 * check that unlocks nothing.
 */
/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { InitiateKycModal } from '../InitiateKycModal'

let mockRestrictions = { banking: false, card: false }
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => mockRestrictions,
}))

let mockIsRegionRestricted = false
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isRegionRestricted: mockIsRegionRestricted }),
}))

jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    // NavHeader mounts the maintenance Banner, which reads the pathname
    usePathname: () => '/kyc',
}))

const onVerify = jest.fn()

const renderModal = (props: Partial<React.ComponentProps<typeof InitiateKycModal>> = {}) =>
    render(
        <IntlWrapper>
            <InitiateKycModal visible onClose={jest.fn()} onVerify={onVerify} {...props} />
        </IntlWrapper>
    )

describe('InitiateKycModal — residence check', () => {
    beforeEach(() => {
        mockRestrictions = { banking: false, card: false }
        mockIsRegionRestricted = false
        onVerify.mockClear()
        mockPush.mockClear()
    })

    it('offers the unlock when banking is available', () => {
        renderModal()
        expect(screen.getByText('Verify identity')).toBeInTheDocument()
        expect(screen.getByTestId('kyc-initiate-cta')).toHaveTextContent('Verify identity')
    })

    it("marks the cross-region continue with the caller's test id", () => {
        renderModal({ variant: 'cross_region', regionName: 'Argentina', ctaTestId: 'kyc-identity-gate-cta' })
        expect(screen.getByTestId('kyc-identity-gate-cta')).toHaveTextContent('Continue')
        expect(screen.queryByTestId('kyc-initiate-cta')).not.toBeInTheDocument()
    })

    it('replaces the unlock offer when the residence rules out bank rails', () => {
        mockRestrictions = { banking: true, card: false }
        renderModal()
        expect(screen.getByText('Not available in this country')).toBeInTheDocument()
        expect(screen.queryByText('Verify identity')).not.toBeInTheDocument()
    })

    it('leaves no path into the SDK for a restricted residence', () => {
        mockRestrictions = { banking: true, card: true }
        renderModal()
        screen.getByRole('button', { name: 'Send or request money' }).click()
        expect(onVerify).not.toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('/send')
    })

    it('outranks a gate variant that would have said contact support', () => {
        mockRestrictions = { banking: true, card: false }
        renderModal({ variant: 'blocked' })
        expect(screen.getByText('Not available in this country')).toBeInTheDocument()
        expect(screen.queryByText('Contact support')).not.toBeInTheDocument()
    })

    it('yields to the UK screen, whose copy is more specific', () => {
        mockRestrictions = { banking: true, card: true }
        renderModal({ variant: 'region-unavailable' })
        expect(screen.getByText('Not available for UK residents')).toBeInTheDocument()
    })

    // page presentation drops the visible heading for the generic unlock offer;
    // the unavailable ending is not generic and must keep its own title
    it('shows the unavailable title in page presentation, not the generic nav title', () => {
        mockRestrictions = { banking: true, card: false }
        renderModal({ presentation: 'page', navTitle: 'Unlock payments' })
        expect(screen.getByRole('heading', { name: 'Not available in this country' })).toBeInTheDocument()
    })

    // api#1738: a rail refused for a (possibly pending) residence the device
    // restriction read cannot see still ends on the neutral screen
    it('shows the country-neutral screen for a residence_bank_restricted rail, without the UK copy', () => {
        renderModal({ variant: 'bank-unavailable' })
        expect(screen.getByText('Not available in this country')).toBeInTheDocument()
        expect(screen.queryByText('Not available for UK residents')).not.toBeInTheDocument()
        expect(screen.queryByText('Verify identity')).not.toBeInTheDocument()
    })

    it('yields to the document-jurisdiction screen', () => {
        mockRestrictions = { banking: true, card: true }
        mockIsRegionRestricted = true
        renderModal()
        expect(screen.getByText("We can't verify IDs from this country")).toBeInTheDocument()
    })
})

describe('InitiateKycModal — a requirement the approved identity never collected', () => {
    beforeEach(() => {
        mockRestrictions = { banking: false, card: false }
        mockIsRegionRestricted = false
        onVerify.mockClear()
    })

    it('says plainly that the bank accounts need a proof of address, not the backend prose', () => {
        renderModal({
            variant: 'provider_rejection',
            reasonCode: 'requirements_missing',
            providerMessage: 'Backend English prose',
        })
        expect(
            screen.getByText(
                "To open your bank accounts, our payment partner needs a proof of address, such as a recent bank statement or utility bill. Add it and we'll finish setting them up automatically."
            )
        ).toBeInTheDocument()
        expect(screen.queryByText('Backend English prose')).not.toBeInTheDocument()
        screen.getByTestId('kyc-supplement-cta').click()
        expect(onVerify).toHaveBeenCalled()
    })

    it.each([undefined, 'page'] as const)(
        'shows a submitted proof of address as review in %s presentation with no collection action',
        (presentation) => {
            renderModal({
                variant: 'provider_rejection',
                reasonCode: 'requirements_in_review',
                providerMessage: 'Backend English prose',
                ...(presentation ? { presentation } : {}),
            })

            expect(screen.getByTestId('kyc-supplement-in-review')).toHaveTextContent(
                "We're checking your proof of address. Bank accounts open once it's approved."
            )
            expect(screen.queryByText('Backend English prose')).not.toBeInTheDocument()
            expect(screen.queryByTestId('kyc-supplement-cta')).not.toBeInTheDocument()
            expect(
                screen.queryByRole('button', { name: /verify|upload|add proof of address/i })
            ).not.toBeInTheDocument()
            expect(onVerify).not.toHaveBeenCalled()
        }
    )
})

describe('InitiateKycModal — a requirement the app cannot collect', () => {
    beforeEach(() => {
        mockRestrictions = { banking: false, card: false }
        mockIsRegionRestricted = false
        onVerify.mockClear()
    })

    it('reads the catalog line and offers support', () => {
        const onContactSupport = jest.fn()
        renderModal({
            variant: 'blocked',
            reasonCode: 'requirements_uncollectable',
            providerMessage: 'Backend English prose',
            onContactSupport,
        })
        expect(
            screen.getByText(
                "Our payment partner needs something we can't collect in the app. Message support and we'll finish setting this up with you."
            )
        ).toBeInTheDocument()
        expect(screen.queryByText('Backend English prose')).not.toBeInTheDocument()
        screen.getByRole('button', { name: 'Contact support' }).click()
        expect(onContactSupport).toHaveBeenCalled()
        expect(onVerify).not.toHaveBeenCalled()
    })
})
