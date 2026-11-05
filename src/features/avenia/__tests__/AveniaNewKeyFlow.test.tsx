/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import type { AveniaRecoveryKey } from '../hooks/useAveniaRecoveryKey'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
const query: Record<string, string> = { intentId: 'w1', destination: '' }
jest.mock('nuqs', () => ({
    useQueryState: (name: string) => [query[name] ?? '', jest.fn()],
    parseAsString: { withDefault: () => ({}) },
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn(), useReturnTo: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))
jest.mock('@/features/avenia/components/AveniaPixKeyStep', () => ({
    AveniaPixKeyStep: ({ intro }: { intro: string }) => <div data-testid="key-step">{intro}</div>,
}))
const mockEntry = jest.fn()
jest.mock('@/hooks/useHistoryEntry', () => ({ useHistoryEntry: () => mockEntry() }))
const mockRecovery = jest.fn<AveniaRecoveryKey, []>()
jest.mock('@/features/avenia/hooks/useAveniaRecoveryKey', () => ({ useAveniaRecoveryKey: () => mockRecovery() }))
jest.mock('@/components/TransactionDetails/transactionTransformer', () => ({
    mapTransactionDataForDrawer: (entry: { status: string }) => ({
        transactionDetails: { status: entry.status.toLowerCase() },
    }),
}))

import { AveniaNewKeyFlow } from '../components/AveniaNewKeyFlow'

const withdrawal = (state: string, status = 'PROCESSING') => ({
    data: { uuid: 'w1', status, extraData: { kind: 'OFFRAMP', aveniaRecoveryPlaceholder: { state } } },
    isError: false,
    refetch: jest.fn(),
})
const recovery = (phase: AveniaRecoveryKey['phase']): AveniaRecoveryKey => ({ submit: jest.fn(), phase, refusal: null })

describe('AveniaNewKeyFlow', () => {
    beforeEach(() => jest.clearAllMocks())

    it('asks for another own key while the money waits for one', () => {
        mockEntry.mockReturnValue(withdrawal('awaiting-key'))
        mockRecovery.mockReturnValue(recovery('idle'))
        render(<AveniaNewKeyFlow />)
        expect(screen.getByTestId('key-step')).toHaveTextContent('intro')
    })

    it("shows the withdrawal's current state after a 409, not the key step", () => {
        // the entry read before the answer still says it waits; the 409 wins
        mockEntry.mockReturnValue(withdrawal('awaiting-key', 'COMPLETED'))
        mockRecovery.mockReturnValue(recovery('not-waiting'))
        render(<AveniaNewKeyFlow />)
        expect(screen.queryByTestId('key-step')).toBeNull()
        expect(screen.getByTestId('avenia-new-key-not-waiting')).toHaveTextContent('notWaiting')
        expect(screen.getByText('status.completed')).toBeInTheDocument()
    })

    it('shows the current state when the link opens on a withdrawal that no longer waits', () => {
        mockEntry.mockReturnValue(withdrawal('done', 'COMPLETED'))
        mockRecovery.mockReturnValue(recovery('idle'))
        render(<AveniaNewKeyFlow />)
        expect(screen.getByTestId('avenia-new-key-not-waiting')).toBeInTheDocument()
    })

    it('says where the money goes once the key is taken', () => {
        mockEntry.mockReturnValue(withdrawal('awaiting-key'))
        mockRecovery.mockReturnValue(recovery('accepted'))
        render(<AveniaNewKeyFlow />)
        expect(screen.getByText('savedTitle')).toBeInTheDocument()
        expect(screen.getByText('saved')).toBeInTheDocument()
    })
})
