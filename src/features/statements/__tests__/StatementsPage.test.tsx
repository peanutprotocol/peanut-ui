import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { StatementsPage } from '../StatementsPage'
import { StatementDownloadError, prepareStatement, saveStatement } from '../statementDownload.utils'
import { toLocalDateString } from '../statementPeriod.utils'

const mockToastSuccess = jest.fn()
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
    useLocale: () => 'en',
    // the helper line shows the period's days; the real formatting is next-intl's
    useFormatter: () => ({
        dateTimeRange: (from: Date, to: Date) => `${toLocalDateString(from)}..${toLocalDateString(to)}`,
    }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'user-1' } } }) }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ success: mockToastSuccess }) }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
jest.mock('@/utils/haptics', () => ({ impactHaptic: jest.fn(), heavyImpactHaptic: jest.fn(), WEB_TAP_MS: 15 }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/components/Card/share-asset/captureShareAsset', () => ({ downloadBlob: jest.fn() }))
jest.mock('../statementDownload.utils', () => ({
    ...jest.requireActual('../statementDownload.utils'),
    prepareStatement: jest.fn(),
    saveStatement: jest.fn(),
}))

const prepare = prepareStatement as jest.Mock
const save = saveStatement as jest.Mock

const renderPage = (search = '') =>
    render(<StatementsPage />, { wrapper: withNuqsTestingAdapter({ searchParams: search, hasMemory: true }) })

// the Field that holds the period select: its label's column
const periodField = () => screen.getByText('period').parentElement!

beforeEach(() => {
    jest.clearAllMocks()
    prepare.mockResolvedValue({ blob: new Blob(['%PDF']), fileName: 'peanut-activity.pdf' })
    save.mockResolvedValue('saved')
})

describe('StatementsPage', () => {
    it('opens on all time and PDF, with no calendar and no dates', () => {
        renderPage()
        expect(screen.getByRole('combobox', { name: 'period' })).toHaveTextContent('periods.allTime')
        expect(screen.getByRole('tab', { name: 'PDF' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.queryByRole('grid')).not.toBeInTheDocument()
        expect(within(periodField()).queryByText(/\.\./)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'download' })).toBeEnabled()
    })

    it('opens a deep link with its period on the calendar and its format chosen', () => {
        renderPage('?from=2026-08-03&to=2026-08-14&format=xlsx')
        expect(screen.getByRole('combobox', { name: 'period' })).toHaveTextContent('periods.custom')
        expect(screen.getByRole('grid')).toBeInTheDocument()
        expect(within(periodField()).getByText('2026-08-03..2026-08-14')).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'XLSX' })).toHaveAttribute('aria-selected', 'true')
    })

    it('confirms a saved file', async () => {
        renderPage('?format=csv')
        fireEvent.click(screen.getByRole('button', { name: 'download' }))
        await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('downloaded'))
        expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ format: 'csv', locale: 'en' }))
    })

    it('shows a period that is too long under the period field, in place of its dates', async () => {
        prepare.mockRejectedValue(new StatementDownloadError('EXPORT_TOO_LARGE'))
        renderPage('?from=2026-01-01&to=2026-08-14')
        fireEvent.click(screen.getByRole('button', { name: 'download' }))

        const alert = await within(periodField()).findByRole('alert')
        expect(alert).toHaveTextContent('errors.tooLarge')
        // the error replaces the helper line, never both (form-field board)
        expect(within(periodField()).queryByText('2026-01-01..2026-08-14')).not.toBeInTheDocument()
        expect(screen.getAllByRole('alert')).toHaveLength(1)
    })

    it('shows a refused download as a flow error above the button', async () => {
        prepare.mockRejectedValue(new StatementDownloadError('EXPORT_UNVERIFIED', 'reward-credit-missing'))
        renderPage('?from=2026-08-03&to=2026-08-14')
        fireEvent.click(screen.getByRole('button', { name: 'download' }))

        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent('errors.unverified')
        expect(periodField()).not.toContainElement(alert)
        const button = screen.getByRole('button', { name: 'download' })
        expect(alert.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(save).not.toHaveBeenCalled()
    })
})
