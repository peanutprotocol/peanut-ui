/**
 * AddMoneyBankDetails — the Bridge bank-transfer instructions screen.
 *
 * Regression tests for the deposit-reference truncation bug: the reference was
 * sliced to 10 chars in display AND copy, so users wired funds with a reference
 * Bridge couldn't reconcile (deposit stuck AWAITING_FUNDS). Every surface that
 * hands the reference to the user must carry the FULL depositMessage. Nested
 * primitives are stubbed so only this component's own logic is under test.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    useParams: () => ({ country: 'germany' }),
}))
jest.mock('nuqs', () => ({
    useQueryState: () => ['100', jest.fn()],
    parseAsString: {},
}))
jest.mock('@/context/OnrampFlowContext', () => ({
    useOnrampFlow: () => mockUseOnrampFlow(),
}))
jest.mock('@/context/RequestFulfillmentFlowContext', () => ({
    RequestFulfillmentBankFlowStep: { BankCountryList: 'BankCountryList' },
    useRequestFulfillmentFlow: () => ({
        setFlowStep: jest.fn(),
        onrampData: undefined,
        selectedCountry: undefined,
    }),
}))
jest.mock('@/hooks/useOnrampQuote', () => ({
    useOnrampQuote: () => ({ netRate: 1, isLoading: false }),
}))

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/Card', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/Global/CopyToClipboard', () => ({
    __esModule: true,
    default: ({ textToCopy }: { textToCopy: string }) => <div data-testid="copy" data-text={textToCopy} />,
}))
jest.mock('@/components/Global/InfoCard', () => ({
    __esModule: true,
    default: ({ title, description, items }: { title?: string; description?: string; items?: string[] }) => (
        <div>
            {title}
            {description}
            {items?.map((item) => (
                <p key={item}>{item}</p>
            ))}
        </div>
    ),
}))
jest.mock('@/components/Payment/PaymentInfoRow', () => ({
    PaymentInfoRow: ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
        <div>
            {label}: {value}
        </div>
    ),
}))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
        <button onClick={onClick}>{children}</button>
    ),
}))
let capturedGenerateText: (() => Promise<string>) | undefined
jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: (props: { generateText: () => Promise<string> }) => {
        capturedGenerateText = props.generateText
        return <div data-testid="share-button" />
    },
}))

const mockUseOnrampFlow = jest.fn()

// eslint-disable-next-line import/first -- must come after jest.mock
import AddMoneyBankDetails from '../AddMoneyBankDetails'

// 20 chars, the real shape of a Bridge deposit message — anything shorter than
// the full string is un-reconcilable by Bridge
const FULL_REFERENCE = 'BRGTESTREF1234567890'

const baseOnrampData = {
    transferId: 'transfer-123',
    depositInstructions: {
        amount: '100',
        currency: 'EUR',
        depositMessage: FULL_REFERENCE,
        bankName: 'Deutsche Bank',
        bankAddress: 'Frankfurt, Germany',
        iban: 'DE89370400440532013000',
        bic: 'COBADEFFXXX',
        accountHolderName: 'Peanut Protocol',
    },
}

beforeEach(() => {
    capturedGenerateText = undefined
    mockUseOnrampFlow.mockReturnValue({ onrampData: baseOnrampData })
})

describe('AddMoneyBankDetails deposit reference', () => {
    it('displays the full reference untruncated and copies the full reference', () => {
        render(<AddMoneyBankDetails onBack={jest.fn()} />)

        // display — the full 20-char reference, not the first 10 chars
        expect(screen.getByText(FULL_REFERENCE)).toBeInTheDocument()
        expect(screen.queryByText(FULL_REFERENCE.slice(0, 10))).not.toBeInTheDocument()

        // the reference copy button carries the full value
        const copyTexts = screen.getAllByTestId('copy').map((el) => el.getAttribute('data-text'))
        expect(copyTexts).toContain(FULL_REFERENCE)
        expect(copyTexts).not.toContain(FULL_REFERENCE.slice(0, 10))
    })

    it('includes the full reference in the "double check before sending" summary', () => {
        render(<AddMoneyBankDetails onBack={jest.fn()} />)

        expect(screen.getByText(`Reference: ${FULL_REFERENCE} (included)`)).toBeInTheDocument()
    })

    it('includes the full reference in the shareable bank-details text', async () => {
        render(<AddMoneyBankDetails onBack={jest.fn()} />)

        expect(capturedGenerateText).toBeDefined()
        const details = await capturedGenerateText!()
        expect(details).toContain(`Deposit Reference: ${FULL_REFERENCE}`)
    })

    it('offers no copy or share while the reference is still loading', () => {
        mockUseOnrampFlow.mockReturnValue({
            onrampData: {
                transferId: 'transfer-123',
                depositInstructions: { ...baseOnrampData.depositInstructions, depositMessage: undefined },
            },
        })
        render(<AddMoneyBankDetails onBack={jest.fn()} />)

        // the 'Loading...' placeholder must never leave the screen — no share
        // blob, no copyable value carrying the literal placeholder
        expect(screen.queryByTestId('share-button')).not.toBeInTheDocument()
        const copyTexts = screen.getAllByTestId('copy').map((el) => el.getAttribute('data-text'))
        expect(copyTexts).not.toContain('Loading...')
    })
})
