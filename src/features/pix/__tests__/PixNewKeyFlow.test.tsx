/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import type { PixRecoveryKey } from '../usePixRecoveryKey'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
const query: Record<string, string> = { intentId: 'w1', destination: '' }
const mockSetQuery = jest.fn()
jest.mock('nuqs', () => ({
    useQueryState: (name: string) => [query[name] ?? '', (value: unknown) => mockSetQuery(name, value)],
    parseAsString: { withDefault: () => ({}) },
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn(), useReturnTo: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))
jest.mock('@/features/pix/components/PixKeyStep', () => ({
    PixKeyStep: ({ intro, initialKey }: { intro: string; initialKey: string }) => (
        <div data-testid="key-step" data-key={initialKey}>
            {intro}
        </div>
    ),
}))
const mockEntry = jest.fn()
jest.mock('@/hooks/useHistoryEntry', () => ({ useHistoryEntry: () => mockEntry() }))
const mockRecovery = jest.fn<PixRecoveryKey, []>()
jest.mock('@/features/pix/usePixRecoveryKey', () => ({ usePixRecoveryKey: () => mockRecovery() }))
jest.mock('@/components/TransactionDetails/transactionTransformer', () => ({
    mapTransactionDataForDrawer: (entry: { status: string }) => ({
        transactionDetails: { status: entry.status.toLowerCase() },
    }),
}))

import { PixNewKeyFlow } from '../components/PixNewKeyFlow'

const withdrawal = (state: string, status = 'PROCESSING') => ({
    data: {
        uuid: 'w1',
        status,
        extraData: {
            kind: 'OFFRAMP',
            provider: 'AVENIA',
            pixRecovery: { state, reason: 'payout-failed', failureCode: 'RECEIVER_ACCOUNT_CLOSED' },
        },
    },
    isError: false,
    refetch: jest.fn(),
})
const recovery = (phase: PixRecoveryKey['phase']): PixRecoveryKey => ({ submit: jest.fn(), phase, refusal: null })

describe('PixNewKeyFlow', () => {
    beforeEach(() => jest.clearAllMocks())

    it('asks for another own key while the money waits for one', () => {
        mockEntry.mockReturnValue(withdrawal('awaiting-key'))
        mockRecovery.mockReturnValue(recovery('idle'))
        render(<PixNewKeyFlow />)
        expect(screen.getByTestId('key-step')).toHaveTextContent('intro')
    })

    // a Pix key in the URL reaches analytics and the request logs: an old link's key fills the field, then goes
    it('takes a key an old link carries into the field and drops it from the URL', () => {
        query.destination = '09579927189'
        mockEntry.mockReturnValue(withdrawal('awaiting-key'))
        mockRecovery.mockReturnValue(recovery('idle'))
        try {
            render(<PixNewKeyFlow />)
            expect(screen.getByTestId('key-step')).toHaveAttribute('data-key', '09579927189')
            expect(mockSetQuery).toHaveBeenCalledWith('destination', null)
        } finally {
            query.destination = ''
        }
    })

    it("shows the withdrawal's current state after a 409, not the key step", () => {
        // the entry read before the answer still says it waits; the 409 wins
        mockEntry.mockReturnValue(withdrawal('awaiting-key', 'COMPLETED'))
        mockRecovery.mockReturnValue(recovery('not-waiting'))
        render(<PixNewKeyFlow />)
        expect(screen.queryByTestId('key-step')).toBeNull()
        expect(screen.getByTestId('pix-new-key-not-waiting')).toHaveTextContent('notWaiting')
        expect(screen.getByText('status.completed')).toBeInTheDocument()
    })

    it('shows the current state when the link opens on a withdrawal that no longer waits', () => {
        mockEntry.mockReturnValue(withdrawal('done', 'COMPLETED'))
        mockRecovery.mockReturnValue(recovery('idle'))
        render(<PixNewKeyFlow />)
        expect(screen.getByTestId('pix-new-key-not-waiting')).toBeInTheDocument()
    })

    it('says where the money goes once the key is taken', () => {
        mockEntry.mockReturnValue(withdrawal('awaiting-key'))
        mockRecovery.mockReturnValue(recovery('accepted'))
        render(<PixNewKeyFlow />)
        expect(screen.getByText('savedTitle')).toBeInTheDocument()
        expect(screen.getByText('saved')).toBeInTheDocument()
    })
})
