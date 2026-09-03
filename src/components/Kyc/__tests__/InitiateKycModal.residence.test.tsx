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
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

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
        expect(screen.getByText('Unlock now')).toBeInTheDocument()
    })

    it('replaces the unlock offer when the residence rules out bank rails', () => {
        mockRestrictions = { banking: true, card: false }
        renderModal()
        expect(screen.getByText('Not available in your country')).toBeInTheDocument()
        expect(screen.queryByText('Unlock now')).not.toBeInTheDocument()
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
        expect(screen.getByText('Not available in your country')).toBeInTheDocument()
        expect(screen.queryByText('Contact support')).not.toBeInTheDocument()
    })

    it('yields to the UK screen, whose copy is more specific', () => {
        mockRestrictions = { banking: true, card: true }
        renderModal({ variant: 'region-unavailable' })
        expect(screen.getByText('Not available for UK residents')).toBeInTheDocument()
    })

    it('yields to the document-jurisdiction screen', () => {
        mockRestrictions = { banking: true, card: true }
        mockIsRegionRestricted = true
        renderModal()
        expect(screen.getByText("We can't verify IDs from your country")).toBeInTheDocument()
    })
})
