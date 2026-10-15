/**
 * CountryListRouter — a bank claim to Argentina or Brazil.
 *
 * Both countries pay out through Manteca, and a send link is never claimed to
 * Manteca directly (TASK-23648). Picking either one asks for an account and
 * carries the regional method across the sign-up, exactly like tapping
 * Mercado Pago or Pix; every other country keeps the bank details form.
 */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/hooks/useRecipientDisplay', () => ({ useRecipientDisplay: () => ({ displayName: 'alice' }) }))
jest.mock('@/hooks/useSavedAccounts', () => ({ __esModule: true, default: () => [] }))

jest.mock('@/components/Common/CountryList', () => ({
    CountryList: ({ onCountryClick }: { onCountryClick: (country: { id: string; path: string }) => void }) => (
        <div>
            <button onClick={() => onCountryClick({ id: 'AR', path: 'argentina' })}>Argentina</button>
            <button onClick={() => onCountryClick({ id: 'BR', path: 'brazil' })}>Brazil</button>
            <button onClick={() => onCountryClick({ id: 'DE', path: 'germany' })}>Germany</button>
        </div>
    ),
}))

const mockAddParamStep = jest.fn()
jest.mock('@/components/Claim/useClaimLink', () => ({
    __esModule: true,
    default: () => ({ addParamStep: (...args: unknown[]) => mockAddParamStep(...args) }),
}))

const mockSetFlowStep = jest.fn()
const mockSetSelectedCountry = jest.fn()
const mockSetVerificationPromptReason = jest.fn()
const mockSetShowVerificationModal = jest.fn()
jest.mock('@/context/ClaimBankFlowContext', () => ({
    ClaimBankFlowStep: {
        SavedAccountsList: 'saved-accounts-list',
        BankDetailsForm: 'bank-details-form',
    },
    useClaimBankFlow: () => ({
        setFlowStep: mockSetFlowStep,
        setSelectedCountry: mockSetSelectedCountry,
        setVerificationPromptReason: mockSetVerificationPromptReason,
        setShowVerificationModal: mockSetShowVerificationModal,
    }),
}))

import { CountryListRouter } from '../CountryListRouter'

const claimLinkData = { amount: 10_000_000n, tokenDecimals: 6, tokenSymbol: 'USDC', senderAddress: '0x9999' } as any

beforeEach(() => jest.clearAllMocks())

describe('bank claim country choice', () => {
    test.each([
        ['Argentina', 'mercadopago'],
        ['Brazil', 'pix'],
    ])('%s asks for an account and carries %s across the sign-up', (country, method) => {
        renderWithIntl(<CountryListRouter claimLinkData={claimLinkData} inputTitle="Country" />)

        fireEvent.click(screen.getByText(country))

        expect(mockAddParamStep).toHaveBeenCalledWith('regional-claim', { method })
        expect(mockSetVerificationPromptReason).toHaveBeenCalledWith('regional-account-required')
        expect(mockSetShowVerificationModal).toHaveBeenCalledWith(true)
        // back to the initial view, where the prompt renders — never a bank form
        expect(mockSetFlowStep).toHaveBeenCalledWith(null)
        expect(mockSetFlowStep).not.toHaveBeenCalledWith('bank-details-form')
    })

    test('any other country keeps the bank details form', () => {
        renderWithIntl(<CountryListRouter claimLinkData={claimLinkData} inputTitle="Country" />)

        fireEvent.click(screen.getByText('Germany'))

        expect(mockSetFlowStep).toHaveBeenCalledWith('bank-details-form')
        expect(mockAddParamStep).not.toHaveBeenCalled()
        expect(mockSetShowVerificationModal).not.toHaveBeenCalled()
    })
})
