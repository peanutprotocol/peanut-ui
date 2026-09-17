/**
 * A user who arrives from one country's add-money flow and has not verified yet
 * is not getting an account — they are turning on that country's bank transfers
 * and payments. The `country_payments` variant says so; the generic "Unlock your
 * account" was what QA read as wrong.
 */
/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { InitiateKycModal } from '../InitiateKycModal'

jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: false, card: false }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isRegionRestricted: false }),
}))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/add-money/argentina/manteca',
}))

const renderModal = (props: Partial<React.ComponentProps<typeof InitiateKycModal>> = {}) =>
    render(
        <IntlWrapper>
            <InitiateKycModal visible onClose={jest.fn()} onVerify={jest.fn()} {...props} />
        </IntlWrapper>
    )

describe('InitiateKycModal — country_payments', () => {
    it('names the country instead of the account', () => {
        renderModal({ variant: 'country_payments', regionName: 'Argentina' })
        expect(screen.getByText('Unlock Argentina')).toBeInTheDocument()
        expect(screen.queryByText('Unlock your account')).not.toBeInTheDocument()
    })

    it('says what the ID check turns on', () => {
        renderModal({ variant: 'country_payments', regionName: 'Argentina' })
        expect(
            screen.getByText('Confirm your ID to turn on bank transfers and payments in Argentina.')
        ).toBeInTheDocument()
    })

    it('keeps the unlock CTA and the prep checklist of a fresh ID check', () => {
        renderModal({ variant: 'country_payments', regionName: 'Brazil', prepPath: 'extended' })
        expect(screen.getByText('Unlock now')).toBeInTheDocument()
    })

    it('falls back to the generic copy with no country name', () => {
        renderModal({ variant: 'country_payments' })
        expect(screen.getByText('Unlock your account')).toBeInTheDocument()
    })

    it('leaves every other caller on the default copy', () => {
        renderModal({ regionName: 'Argentina' })
        expect(screen.getByText('Unlock your account')).toBeInTheDocument()
    })

    it('shows the Argentina tax ID in the prep checklist, not a Brazilian CPF', () => {
        renderModal({ variant: 'country_payments', regionName: 'Argentina', prepPath: 'extended', taxIdCountry: 'AR' })
        expect(screen.getByText('CUIT or CUIL, from your DNI. Needed for local bank transfers.')).toBeInTheDocument()
        expect(
            screen.queryByText('CPF in Brazil, CUIT or CUIL in Argentina. Needed for local bank transfers.')
        ).not.toBeInTheDocument()
    })

    it('shows the Brazil tax ID in the prep checklist for a BR country', () => {
        renderModal({ variant: 'country_payments', regionName: 'Brazil', prepPath: 'extended', taxIdCountry: 'BR' })
        expect(screen.getByText('CPF. Needed for local bank transfers.')).toBeInTheDocument()
    })
})
