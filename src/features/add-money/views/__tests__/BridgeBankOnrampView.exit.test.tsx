/**
 * BridgeBankOnrampView — the settled-deposit exit contract.
 *
 * The `showDetails` screen is settled: the onramp is already created. Its back
 * control must LEAVE the flow the way the amount step does (the flow's outermost
 * `onBack`), not return to `inputAmount` — a return there lets the user start a
 * second deposit. Only that wiring is under test; the flow hook is stubbed.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const mockOnBack = jest.fn()
let mockFlow: Record<string, any> = {}
jest.mock('../../useBridgeBankFlow', () => ({ useBridgeBankFlow: () => mockFlow }))

// Surface the child's back control as a button so the test can fire it.
jest.mock('@/components/AddMoney/components/AddMoneyBankDetails', () => ({
    __esModule: true,
    default: ({ onBack }: { onBack: () => void }) => <button onClick={onBack}>bank-back</button>,
}))

import { BridgeBankOnrampView } from '../BridgeBankOnrampView'

beforeEach(() => {
    jest.clearAllMocks()
    mockFlow = {
        urlState: { step: 'showDetails' },
        setUrlState: jest.fn(),
        user: {},
        selectedCountry: { id: 'DE' },
        onBack: mockOnBack,
        gate: { kind: 'ready' },
        onrampData: { transferId: 't1' },
        t: (k: string) => k,
        tCommon: (k: string) => k,
    }
})

it('leaves the flow on back from the settled bank-details screen, not to the amount step', () => {
    render(<BridgeBankOnrampView />)

    fireEvent.click(screen.getByText('bank-back'))

    expect(mockOnBack).toHaveBeenCalledTimes(1)
    expect(mockFlow.setUrlState).not.toHaveBeenCalledWith({ step: 'inputAmount' })
})
