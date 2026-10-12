import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { StatementsPage } from '../StatementsPage'
import { StatementDownloadError, downloadStatement, prepareStatement, saveStatement } from '../statementDownload.utils'
import { presetDates, toLocalDateString } from '../statementPeriod.utils'
import { scrollClearOfBottomNav } from '@/utils/bottom-nav-clearance.utils'
import { isCapacitor } from '@/utils/capacitor'

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
jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn() }))
jest.mock('@/utils/bottom-nav-clearance.utils', () => ({ scrollClearOfBottomNav: jest.fn() }))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/components/Card/share-asset/captureShareAsset', () => ({ downloadBlob: jest.fn() }))
jest.mock('../statementDownload.utils', () => ({
    ...jest.requireActual('../statementDownload.utils'),
    prepareStatement: jest.fn(),
    saveStatement: jest.fn(),
    downloadStatement: jest.fn(),
}))

const prepare = prepareStatement as jest.Mock
const save = saveStatement as jest.Mock
const saveToDevice = downloadStatement as jest.Mock
const native = isCapacitor as jest.Mock

function renderPage(search = '') {
    const updates: UrlUpdateEvent[] = []
    render(<StatementsPage />, {
        wrapper: withNuqsTestingAdapter({ searchParams: search, hasMemory: true, onUrlUpdate: (e) => updates.push(e) }),
    })
    return { updates, url: () => updates.at(-1)?.searchParams }
}

// the Field that holds a select: its label's column, with the helper or error line
const periodField = () => screen.getByText('period').parentElement!
const periodSelect = () => screen.getByRole('combobox', { name: 'period' })
const formatSelect = () => screen.getByRole('combobox', { name: 'format' })
const choose = (select: () => HTMLElement, name: string) => {
    fireEvent.click(select())
    fireEvent.click(screen.getByRole('option', { name }))
}
const calendar = () => screen.queryByRole('grid')
const day = (iso: string) => document.querySelector(`[data-day="${iso}"]`)
const tapDay = (iso: string) => fireEvent.click(day(iso)!.querySelector('button')!)
const downloadButton = () => screen.getByRole('button', { name: 'download' })
const generateButton = () => screen.getByRole('button', { name: 'generate' })
const shareButton = () => screen.getByRole('button', { name: 'share' })

// URL writes flush after the handler returns; wait past that before asserting none happened
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)))

beforeAll(() => {
    // radix select scrolls its selected option into view; jsdom has no layout
    Element.prototype.scrollIntoView = jest.fn()
})

beforeEach(() => {
    jest.clearAllMocks()
    native.mockReturnValue(false)
    prepare.mockResolvedValue({ blob: new Blob(['%PDF']), fileName: 'peanut-activity.pdf', byYear: false })
    save.mockResolvedValue('saved')
    saveToDevice.mockResolvedValue('documents')
})

describe('StatementsPage', () => {
    it('opens on all time and PDF, with no calendar and no dates', () => {
        renderPage()
        expect(periodSelect()).toHaveTextContent('periods.allTime')
        expect(formatSelect()).toHaveTextContent('PDF')
        expect(calendar()).not.toBeInTheDocument()
        expect(within(periodField()).queryByText(/\.\./)).not.toBeInTheDocument()
        expect(downloadButton()).toBeEnabled()
    })

    it('opens a deep link on "Custom period" with its days on the calendar, its dates under the field and its format chosen', () => {
        renderPage('?from=2026-08-03&to=2026-08-14&format=xlsx')
        expect(periodSelect()).toHaveTextContent('periods.custom')
        expect(calendar()).toBeInTheDocument()
        expect(day('2026-08-03')).toHaveAttribute('aria-selected', 'true')
        expect(day('2026-08-14')).toHaveAttribute('aria-selected', 'true')
        expect(within(periodField()).getByText('2026-08-03..2026-08-14')).toBeInTheDocument()
        expect(formatSelect()).toHaveTextContent('XLSX')
        expect(downloadButton()).toBeEnabled()
    })

    it('moves ?format= with the format select, and the export asks for that format and period', async () => {
        const { url } = renderPage('?from=2026-08-03&to=2026-08-14')
        expect(formatSelect()).toHaveTextContent('PDF')

        choose(formatSelect, 'CSV')

        await waitFor(() => expect(url()?.get('format')).toBe('csv'))
        expect(formatSelect()).toHaveTextContent('CSV')

        fireEvent.click(downloadButton())
        await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('downloaded'))
        expect(prepare).toHaveBeenCalledWith({
            format: 'csv',
            locale: 'en',
            fromIso: new Date(2026, 7, 3).toISOString(),
            toIso: new Date(2026, 7, 14, 23, 59, 59, 999).toISOString(),
        })
    })

    it('shows the calendar on the page for "Custom period", waits for a first day, and writes the tapped days', async () => {
        const { url, updates } = renderPage()
        choose(periodSelect, 'periods.custom')

        expect(calendar()).toBeInTheDocument()
        expect(within(periodField()).getByText('customPeriod.description')).toBeInTheDocument()
        expect(downloadButton()).toBeDisabled()
        await settle()
        expect(updates).toHaveLength(0)

        // the calendar opens on this month when there is no period yet
        const today = toLocalDateString(new Date())
        tapDay(today)
        await waitFor(() => expect(url()?.get('from')).toBe(today))
        expect(url()?.get('to')).toBe(today)
        expect(periodSelect()).toHaveTextContent('periods.custom')
        expect(within(periodField()).getByText(`${today}..${today}`)).toBeInTheDocument()
        expect(downloadButton()).toBeEnabled()

        // a preset takes the calendar away again
        choose(periodSelect, 'periods.allTime')
        await waitFor(() => expect(url()?.has('from')).toBe(false))
        expect(calendar()).not.toBeInTheDocument()
    })

    it('opens the calendar on a preset’s days when "Custom period" is chosen over it, and changes nothing until a tap', async () => {
        const dates = presetDates('last30d')!
        const { updates } = renderPage(`?from=${dates.from}&to=${dates.to}`)
        choose(periodSelect, 'periods.custom')

        expect(periodSelect()).toHaveTextContent('periods.custom')
        expect(day(dates.from)).toHaveAttribute('aria-selected', 'true')
        expect(downloadButton()).toBeEnabled()
        await settle()
        expect(updates).toHaveLength(0)
        expect(mockCapture).not.toHaveBeenCalled()
    })

    it('confirms a saved file', async () => {
        renderPage('?format=csv')
        fireEvent.click(downloadButton())
        await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('downloaded'))
        expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ format: 'csv', locale: 'en' }))
    })

    it('downloads on the web in one tap, with no Generate and no Share', async () => {
        renderPage()
        expect(screen.queryByRole('button', { name: 'generate' })).not.toBeInTheDocument()
        fireEvent.click(downloadButton())
        await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
        expect(screen.queryByRole('button', { name: 'share' })).not.toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: /download|generate|share/ })).toHaveLength(1)
        expect(saveToDevice).not.toHaveBeenCalled()
    })

    describe('in the app', () => {
        beforeEach(() => native.mockReturnValue(true))

        it('generates the file first, then offers Share and Download', async () => {
            renderPage('?format=csv')
            expect(screen.queryByRole('button', { name: 'download' })).not.toBeInTheDocument()

            fireEvent.click(generateButton())
            await waitFor(() => expect(shareButton()).toBeInTheDocument())
            expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ format: 'csv' }))
            expect(save).not.toHaveBeenCalled()
            expect(screen.queryByRole('button', { name: 'generate' })).not.toBeInTheDocument()
            // Share is the primary and comes first; Download is the secondary under it
            expect(
                shareButton().compareDocumentPosition(downloadButton()) & Node.DOCUMENT_POSITION_FOLLOWING
            ).toBeTruthy()

            fireEvent.click(shareButton())
            await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
            await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('downloaded'))
            expect(saveToDevice).not.toHaveBeenCalled()

            fireEvent.click(downloadButton())
            await waitFor(() => expect(saveToDevice).toHaveBeenCalledTimes(1))
            await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('savedToDocuments'))
            expect(prepare).toHaveBeenCalledTimes(1)
        })

        it('confirms a Download that fell back to the share sheet like a share', async () => {
            saveToDevice.mockResolvedValue('saved')
            renderPage()
            fireEvent.click(generateButton())
            fireEvent.click(await screen.findByRole('button', { name: 'download' }))
            await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('downloaded'))
            expect(mockToastSuccess).not.toHaveBeenCalledWith('savedToDocuments')
        })

        it('goes back to Generate when the format changes', async () => {
            renderPage()
            fireEvent.click(generateButton())
            await waitFor(() => expect(shareButton()).toBeInTheDocument())

            choose(formatSelect, 'XLSX')
            await waitFor(() => expect(generateButton()).toBeInTheDocument())
            expect(screen.queryByRole('button', { name: 'share' })).not.toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'download' })).not.toBeInTheDocument()
        })
    })

    it('says that a long period came as one file per year, in place of the plain confirmation', async () => {
        prepare.mockResolvedValue({ blob: new Blob(['PK']), fileName: 'peanut-activity.zip', byYear: true })
        renderPage()
        fireEvent.click(downloadButton())
        await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('downloadedByYear'))
        expect(mockToastSuccess).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows a period that is too long under the period field, in place of its dates', async () => {
        prepare.mockRejectedValue(new StatementDownloadError('EXPORT_TOO_LARGE'))
        renderPage('?from=2026-01-01&to=2026-08-14')
        fireEvent.click(downloadButton())

        const alert = await within(periodField()).findByRole('alert')
        expect(alert).toHaveTextContent('errors.tooLarge')
        // the error replaces the helper line, never both (form-field board)
        expect(within(periodField()).queryByText('2026-01-01..2026-08-14')).not.toBeInTheDocument()
        expect(screen.getAllByRole('alert')).toHaveLength(1)
        // the shorter period is picked right there on the calendar
        expect(calendar()).toBeInTheDocument()
    })

    it('shows a refused download as a flow error under the button', async () => {
        prepare.mockRejectedValue(new StatementDownloadError('EXPORT_UNVERIFIED', 'reward-credit-missing'))
        renderPage('?from=2026-08-03&to=2026-08-14')
        fireEvent.click(downloadButton())

        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent('errors.unverified')
        expect(periodField()).not.toContainElement(alert)
        // the CTA stays the pinned element and the error reads just under it (Aleks, 2026-10-12)
        expect(downloadButton().compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        // the page is long with the calendar open: the failure brings itself out from under the nav
        expect(scrollClearOfBottomNav).toHaveBeenCalledWith(alert.parentElement)
        expect(save).not.toHaveBeenCalled()
    })

    it('brings Download out from under the bottom nav when a tap gives the period a last day, and not when a link opens on one', async () => {
        renderPage('?from=2026-08-03&to=2026-08-14')
        await settle()
        expect(scrollClearOfBottomNav).not.toHaveBeenCalled()

        // a tap on a finished period starts a new one, which has no last day yet
        tapDay('2026-08-20')
        await settle()
        expect(scrollClearOfBottomNav).not.toHaveBeenCalled()

        tapDay('2026-08-25')
        await waitFor(() => expect(scrollClearOfBottomNav).toHaveBeenCalledTimes(1))
        expect(scrollClearOfBottomNav).toHaveBeenCalledWith(downloadButton())
    })
})
