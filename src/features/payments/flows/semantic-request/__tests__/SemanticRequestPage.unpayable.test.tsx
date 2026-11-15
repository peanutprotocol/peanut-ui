/**
 * A ?chargeId= link skips the URL parser, so its token is checked on the
 * charge (TASK-23850). A request in a token requests no longer take (an ETH
 * request made before USDC-or-USDT-only) shows why it can't be paid and never
 * opens Confirm. A paid one keeps its receipt.
 */
import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { TRequestChargeResponse } from '@/services/services.types'
import { SemanticRequestPage } from '../SemanticRequestPage'

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <h1>{title}</h1>,
}))

// Confirm stands in for the real view: on mount it loads the charge into the
// flow the way the fetch effect does, a paid one switching to its receipt.
let mockFetchedCharge: TRequestChargeResponse
jest.mock('../views/SemanticRequestConfirmView', () => ({
    SemanticRequestConfirmView: function MockConfirm() {
        const { setCharge, setCurrentView } = jest
            .requireActual('../SemanticRequestFlowContext')
            .useSemanticRequestFlowContext()
        jest.requireActual('react').useEffect(() => {
            setCharge(mockFetchedCharge)
            if (mockFetchedCharge.fulfillmentPayment?.status === 'SUCCESSFUL') setCurrentView('RECEIPT')
        }, [setCharge, setCurrentView])
        return <p>Confirm view</p>
    },
}))
jest.mock('../views/SemanticRequestInputView', () => ({ SemanticRequestInputView: () => <p>Input view</p> }))
jest.mock('../views/SemanticRequestSuccessView', () => ({ SemanticRequestSuccessView: () => <p>Success view</p> }))
jest.mock('../views/SemanticRequestExternalWalletView', () => ({ __esModule: true, default: () => null }))
jest.mock('../views/SemanticRequestReceiptView', () => ({ SemanticRequestReceiptView: () => <p>Receipt view</p> }))

const UNPAYABLE = "This request can't be paid anymore. Ask for a new one in USDC."

const charge = (tokenSymbol: string, paid = false) =>
    ({
        uuid: 'charge-1',
        chainId: '8453',
        tokenSymbol,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenAmount: '0.1',
        tokenDecimals: 18,
        fulfillmentPayment: paid ? { status: 'SUCCESSFUL' } : null,
        requestLink: { recipientAddress: '0x1111111111111111111111111111111111111111' },
    }) as unknown as TRequestChargeResponse

// an address recipient with a chargeId opens on Confirm
const renderChargeLink = () =>
    renderWithIntl(
        <SemanticRequestPage
            parsedUrl={{ recipient: null, amount: undefined, token: undefined, chain: undefined }}
            initialChargeId="charge-1"
        />
    )

describe('a ?chargeId= link in a token requests no longer take', () => {
    it.each(['ETH', 'DAI'])('a %s charge says it cannot be paid and never shows Confirm', async (symbol) => {
        mockFetchedCharge = charge(symbol)
        renderChargeLink()

        expect(await screen.findByText(UNPAYABLE)).toBeInTheDocument()
        expect(screen.queryByText('Confirm view')).toBeNull()
    })

    it.each(['USDC', 'USDT'])('a %s charge still opens Confirm', async (symbol) => {
        mockFetchedCharge = charge(symbol)
        renderChargeLink()

        expect(await screen.findByText('Confirm view')).toBeInTheDocument()
        expect(screen.queryByText(UNPAYABLE)).toBeNull()
    })

    it('a paid ETH charge keeps its receipt', async () => {
        mockFetchedCharge = charge('ETH', true)
        renderChargeLink()

        expect(await screen.findByText('Receipt view')).toBeInTheDocument()
        expect(screen.queryByText(UNPAYABLE)).toBeNull()
    })
})
