import type { ReactNode } from 'react'
import { act, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { FeatureReport, FeatureReportEntry } from '@/types/capabilities'
import { renderWithIntl } from '@/test-utils/intl'
import { resetBankReadyReminder } from '@/test-utils/bankReadyReminder'
import { markBankReadyShown, markReshowing, shownBankReady } from '../bankReadyReminder'
import { VerifiedPage } from '../VerifiedPage'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
let mockStatus: string | undefined
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'u1', username: 'lena' }, identityVerification: { status: mockStatus } },
    }),
}))
let mockReport: FeatureReport
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ capabilities: { features: mockReport, routes: [], rails: [], nextActions: [] } }),
}))
let mockReadiness: { isLoading: boolean; pickerMethods: string[] }
jest.mock('../../useAddMoneyReadiness', () => ({ useAddMoneyReadiness: () => mockReadiness }))
jest.mock('../../useAddMoneyMethodRows', () => ({
    useAddMoneyMethodRows: () =>
        new Proxy(
            {},
            { get: (_, method) => ({ title: String(method), description: `${String(method)} row`, icon: null }) }
        ),
    addMoneyMethodHref: () => '/add-money',
}))
jest.mock('@/features/deposit-accounts/useDepositGateRemediation', () => ({
    useDepositGateRemediation: () => ({ resolveGate: jest.fn(), modals: null }),
}))
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: jest.fn() }))
jest.mock('@/features/paperwork-verification/useInsetColor', () => ({ restoreNativeStatusBar: () => {} }))
jest.mock('@/features/paperwork-verification/verifySource', () => ({ currentVerifySource: () => null }))
jest.mock('../VerifiedArt', () => ({ VerifiedArt: () => null }))
jest.mock('@/components/Setup/redesign/shell/SetupShell', () => ({
    SetupShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
jest.mock('@/components/Setup/redesign/shell/SetupScreen', () => ({
    SetupScreen: ({ stageCopy, children }: { stageCopy: ReactNode; children: ReactNode }) => (
        <div>
            {stageCopy}
            {children}
        </div>
    ),
}))
jest.mock('@/components/Setup/redesign/shell/NameChip', () => ({ NameChip: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))

const capture = posthog.capture as jest.Mock
const on: FeatureReportEntry = { state: 'on' }
const report = (bank: Record<string, FeatureReportEntry>, local: Record<string, FeatureReportEntry> = {}) =>
    ({
        qr: on,
        card: { state: 'ready' },
        bank: { state: 'on', accounts: bank },
        local: { state: 'on', accounts: local },
    }) as FeatureReport
const eventsNamed = (name: string) => capture.mock.calls.filter(([event]) => event === name)

beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    capture.mockClear()
    resetBankReadyReminder()
    markBankReadyShown('u1', [])
    mockStatus = 'verified'
    mockReport = report({ USD: on, EUR: on }, { ARS: on, BRL: on })
    mockReadiness = { isLoading: false, pickerMethods: ['ars', 'bank', 'crypto'] }
})

describe('VerifiedPage, bank-ready variant', () => {
    it('names the open accounts that have a row: Your USD, EUR, and ARS accounts are open', () => {
        renderWithIntl(<VerifiedPage variant="bank-ready" />)
        expect(screen.getByText('Bank account ready')).toBeTruthy()
        expect(screen.getByText(/Your USD, EUR, and ARS accounts are open\. Add money\./)).toBeTruthy()
    })

    it('records the accounts it shows, and only those with a row (BRL has none here)', () => {
        renderWithIntl(<VerifiedPage variant="bank-ready" />)
        expect(shownBankReady('u1')).toEqual(['bank.USD', 'bank.EUR', 'local.ARS'])
    })

    it('records nothing while the picker rows load, then records once they have loaded', () => {
        mockReadiness = { isLoading: true, pickerMethods: ['ars', 'bank', 'crypto'] }
        const view = renderWithIntl(<VerifiedPage variant="bank-ready" />)
        expect(shownBankReady('u1')).toEqual([])

        mockReadiness = { isLoading: false, pickerMethods: ['ars', 'bank', 'crypto'] }
        view.rerender(<VerifiedPage variant="bank-ready" />)
        expect(shownBankReady('u1')).toEqual(['bank.USD', 'bank.EUR', 'local.ARS'])
    })

    it('records nothing while access waits (identity still processing), and nothing once it leaves', () => {
        jest.useFakeTimers()
        mockStatus = 'processing'
        renderWithIntl(<VerifiedPage variant="bank-ready" />)
        expect(screen.getByText('loading')).toBeTruthy()
        expect(shownBankReady('u1')).toEqual([])
        // the 30 s wait ends without a verification: the page leaves for Home, never shown
        act(() => jest.runOnlyPendingTimers())
        expect(shownBankReady('u1')).toEqual([])
        expect(eventsNamed(ANALYTICS_EVENTS.VERIFIED_PAGE_SHOWN)).toHaveLength(0)
        jest.useRealTimers()
    })

    it('reports the re-show once, for the visit Home opened', () => {
        markReshowing(['bank.USD'])
        const view = renderWithIntl(<VerifiedPage variant="bank-ready" />)
        view.rerender(<VerifiedPage variant="bank-ready" />)
        expect(eventsNamed(ANALYTICS_EVENTS.VERIFIED_PAGE_RESHOWN)).toEqual([
            [ANALYTICS_EVENTS.VERIFIED_PAGE_RESHOWN, { accounts: ['bank.USD'], variant: 'bank-ready' }],
        ])
    })

    it('reports no re-show for a visit Home did not open (the push, a direct link)', () => {
        renderWithIntl(<VerifiedPage variant="bank-ready" />)
        expect(eventsNamed(ANALYTICS_EVENTS.VERIFIED_PAGE_SHOWN)).toHaveLength(1)
        expect(eventsNamed(ANALYTICS_EVENTS.VERIFIED_PAGE_RESHOWN)).toHaveLength(0)
    })

    it('a Home-opened visit left before it showed ends the hand-off: a later direct visit reports nothing', () => {
        markReshowing(['bank.USD'])
        mockStatus = 'processing'
        renderWithIntl(<VerifiedPage variant="bank-ready" />).unmount()
        mockStatus = 'verified'
        renderWithIntl(<VerifiedPage variant="bank-ready" />)
        expect(eventsNamed(ANALYTICS_EVENTS.VERIFIED_PAGE_RESHOWN)).toHaveLength(0)
    })
})
