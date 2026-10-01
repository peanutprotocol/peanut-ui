import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { dispatchBackPress } from '@/utils/back-handler'
import { StatementsPage } from '../StatementsPage'
import { StatementDownloadError, prepareStatement, saveStatement } from '../statementDownload.utils'
import { presetDates, toLocalDateString } from '../statementPeriod.utils'

const mockToastSuccess = jest.fn()
const mockCapture = jest.fn()
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
    useLocale: () => 'en',
    // the helper line shows the period's days; the real formatting is next-intl's
    useFormatter: () => ({
        dateTimeRange: (from: Date, to: Date) => `${toLocalDateString(from)}..${toLocalDateString(to)}`,
    }),
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))
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

function renderPage(search = '') {
    const updates: UrlUpdateEvent[] = []
    render(<StatementsPage />, {
        wrapper: withNuqsTestingAdapter({ searchParams: search, hasMemory: true, onUrlUpdate: (e) => updates.push(e) }),
    })
    return { updates, url: () => updates.at(-1)?.searchParams }
}

// vaul keeps a closed sheet mounted until its exit animation ends, which never
// fires in jsdom, and radix keeps the page aria-hidden until then. So the page
// is queried with `hidden: true`, and the sheet's own state says it closed.
const byRole = { hidden: true }

// the Field that holds the period select: its label's column
const periodField = () => screen.getByText('period').parentElement!
const periodSelect = () => screen.getByRole('combobox', { name: 'period', ...byRole })
const changeDates = () => within(periodField()).queryByRole('button', { name: 'changeDates', ...byRole })
// the Field that holds the format select: its label's column, with the hint line
const formatField = () => screen.getByText('format').parentElement!
const formatSelect = () => screen.getByRole('combobox', { name: 'format', ...byRole })
const chooseFormat = (name: string) => {
    fireEvent.click(formatSelect())
    fireEvent.click(screen.getByRole('option', { name }))
}
const drawer = () => screen.queryByRole('dialog')
const day = (iso: string) => document.querySelector(`[data-day="${iso}"]`)
const tapDay = (iso: string) => fireEvent.click(day(iso)!.querySelector('button')!)
// the calendar opens on the draft's month, which is not always today's (a
// preset's first day usually sits in the previous month), so tests that only
// need "some day was tapped" take the first enabled one on screen
const tapFirstEnabledDay = () => fireEvent.click(document.querySelector('[data-day] button:not([disabled])')!)

function chooseCustomPeriod() {
    fireEvent.click(periodSelect())
    fireEvent.click(screen.getByRole('option', { name: 'periods.custom' }))
}

const expectDrawerClosed = () => {
    const sheet = screen.queryByRole('dialog', byRole)
    if (sheet) expect(sheet).toHaveAttribute('data-state', 'closed')
}

// URL writes flush after the handler returns; wait past that before asserting none happened
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)))

beforeAll(() => {
    // radix select scrolls its selected option into view; jsdom has no layout
    Element.prototype.scrollIntoView = jest.fn()
})

beforeEach(() => {
    jest.clearAllMocks()
    prepare.mockResolvedValue({ blob: new Blob(['%PDF']), fileName: 'peanut-activity.pdf' })
    save.mockResolvedValue('saved')
})

describe('StatementsPage', () => {
    it('opens on all time and PDF, with no drawer and no dates', () => {
        renderPage()
        expect(periodSelect()).toHaveTextContent('periods.allTime')
        expect(formatSelect()).toHaveTextContent('PDF')
        expect(within(formatField()).getByText('formatHints.pdf')).toBeInTheDocument()
        expect(drawer()).not.toBeInTheDocument()
        expect(within(periodField()).queryByText(/\.\./)).not.toBeInTheDocument()
        expect(changeDates()).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'download' })).toBeEnabled()
    })

    it('opens a deep link on "Custom period" with its dates under the field, the drawer closed and its format chosen', () => {
        renderPage('?from=2026-08-03&to=2026-08-14&format=xlsx')
        expect(periodSelect()).toHaveTextContent('periods.custom')
        expect(drawer()).not.toBeInTheDocument()
        expect(within(periodField()).getByText('2026-08-03..2026-08-14')).toBeInTheDocument()
        expect(changeDates()).toBeInTheDocument()
        expect(formatSelect()).toHaveTextContent('XLSX')
        expect(within(formatField()).getByText('formatHints.xlsx')).toBeInTheDocument()
    })

    it('moves ?format= and the hint with the format select, and the export asks for that format and period', async () => {
        const { url } = renderPage('?from=2026-08-03&to=2026-08-14')
        expect(formatSelect()).toHaveTextContent('PDF')
        expect(within(formatField()).getByText('formatHints.pdf')).toBeInTheDocument()

        chooseFormat('CSV')

        await waitFor(() => expect(url()?.get('format')).toBe('csv'))
        expect(formatSelect()).toHaveTextContent('CSV')
        // the hint follows the choice, one line, never both (form-field board)
        expect(within(formatField()).getByText('formatHints.csv')).toBeInTheDocument()
        expect(within(formatField()).queryByText('formatHints.pdf')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'download' }))
        await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('downloaded'))
        expect(prepare).toHaveBeenCalledWith({
            format: 'csv',
            locale: 'en',
            fromIso: new Date(2026, 7, 3).toISOString(),
            toIso: new Date(2026, 7, 14, 23, 59, 59, 999).toISOString(),
        })
    })

    describe.each([
        ['Escape', () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })],
        ['the hardware back button', () => act(() => void dispatchBackPress())],
    ])('closing the drawer with %s, without Apply', (_, close) => {
        it.each([
            ['all time', '', 'periods.allTime'],
            ['a preset', `?from=${presetDates('last30d')!.from}&to=${presetDates('last30d')!.to}`, 'periods.last30d'],
        ])('keeps %s, never a custom period without days', async (__, search, shown) => {
            const { updates } = renderPage(search)
            chooseCustomPeriod()
            expect(drawer()).toHaveAttribute('data-state', 'open')
            expect(within(drawer()!).getByRole('heading', { name: 'periods.custom' })).toBeInTheDocument()
            tapFirstEnabledDay()

            close()

            expectDrawerClosed()
            expect(periodSelect()).toHaveTextContent(shown)
            expect(changeDates()).not.toBeInTheDocument()
            await settle()
            expect(updates).toHaveLength(0)
            expect(mockCapture).not.toHaveBeenCalled()
        })
    })

    it('Apply writes the period and closes the drawer; "Change dates" reopens it on the applied days', async () => {
        const { url } = renderPage()
        chooseCustomPeriod()
        const today = toLocalDateString(new Date())
        tapDay(today)
        fireEvent.click(within(drawer()!).getByRole('button', { name: 'customPeriod.apply' }))

        expectDrawerClosed()
        await waitFor(() => expect(url()?.get('from')).toBe(today))
        expect(url()?.get('to')).toBe(today)
        expect(periodSelect()).toHaveTextContent('periods.custom')
        expect(within(periodField()).getByText(`${today}..${today}`)).toBeInTheDocument()
        expect(mockCapture).toHaveBeenCalledWith('activity_range_applied', { range_preset: 'custom', range_days: 1 })

        // choosing "Custom period" again does not reach the page, so the helper line carries the way back
        fireEvent.click(changeDates()!)
        expect(drawer()).toHaveAttribute('data-state', 'open')
        expect(day(today)).toHaveAttribute('aria-selected', 'true')
    })

    it('confirms a saved file', async () => {
        renderPage('?format=csv')
        fireEvent.click(screen.getByRole('button', { name: 'download' }))
        await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('downloaded'))
        expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ format: 'csv', locale: 'en' }))
    })

    it('shows a period that is too long under the period field, in place of its dates, and keeps "Change dates"', async () => {
        prepare.mockRejectedValue(new StatementDownloadError('EXPORT_TOO_LARGE'))
        renderPage('?from=2026-01-01&to=2026-08-14')
        fireEvent.click(screen.getByRole('button', { name: 'download' }))

        const alert = await within(periodField()).findByRole('alert')
        expect(alert).toHaveTextContent('errors.tooLarge')
        // the error replaces the helper line, never both (form-field board)
        expect(within(periodField()).queryByText('2026-01-01..2026-08-14')).not.toBeInTheDocument()
        expect(screen.getAllByRole('alert')).toHaveLength(1)
        // a shorter custom period is picked in the drawer, so its way in stays
        expect(alert).toContainElement(changeDates())
        fireEvent.click(changeDates()!)
        expect(drawer()).toHaveAttribute('data-state', 'open')
    })

    it('shows a refused download as a flow error under the button', async () => {
        prepare.mockRejectedValue(new StatementDownloadError('EXPORT_UNVERIFIED', 'reward-credit-missing'))
        renderPage('?from=2026-08-03&to=2026-08-14')
        fireEvent.click(screen.getByRole('button', { name: 'download' }))

        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent('errors.unverified')
        expect(periodField()).not.toContainElement(alert)
        // the outcome reads under the action that caused it; the CTA never moves
        const button = screen.getByRole('button', { name: 'download' })
        expect(button.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(save).not.toHaveBeenCalled()
    })
})
