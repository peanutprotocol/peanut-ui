import { act, renderHook } from '@testing-library/react'
import { useStatementDownload } from '../useStatementDownload'
import { StatementDownloadError, prepareStatement, saveStatement } from '../statementDownload.utils'
import { isCapacitor } from '@/utils/capacitor'

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))
jest.mock('next-intl', () => ({ useLocale: () => 'es-AR' }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'user-1' } } }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn() }))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/components/Card/share-asset/captureShareAsset', () => ({ downloadBlob: jest.fn() }))
// the request itself is covered in statementDownload.utils.test.ts; here the
// hook's own decisions: what it asks for, when it saves, what a failure shows
jest.mock('../statementDownload.utils', () => ({
    ...jest.requireActual('../statementDownload.utils'),
    prepareStatement: jest.fn(),
    saveStatement: jest.fn(),
}))

const prepare = prepareStatement as jest.Mock
const save = saveStatement as jest.Mock
const native = isCapacitor as jest.Mock
const FILE = { blob: new Blob(['%PDF']), fileName: 'peanut-activity_2026-08-03_2026-08-14.pdf' }

const AUGUST = {
    from: '2026-08-03',
    to: '2026-08-14',
    fromIso: '2026-08-03T03:00:00.000Z',
    toIso: '2026-08-15T02:59:59.999Z',
}

function renderDownload(overrides: Partial<Parameters<typeof useStatementDownload>[0]> = {}) {
    const onSaved = jest.fn()
    const view = renderHook((props: Parameters<typeof useStatementDownload>[0]) => useStatementDownload(props), {
        initialProps: { format: 'csv', ...AUGUST, preset: undefined, onSaved, ...overrides },
    })
    return { ...view, onSaved }
}

beforeEach(() => {
    jest.clearAllMocks()
    native.mockReturnValue(false)
    prepare.mockResolvedValue(FILE)
    save.mockResolvedValue('saved')
})

describe('useStatementDownload', () => {
    it('asks for the chosen format and period in the app locale, and saves on the same tap on the web', async () => {
        const { result, onSaved } = renderDownload()
        await act(() => result.current.download())

        expect(prepare).toHaveBeenCalledWith({
            format: 'csv',
            locale: 'es-AR',
            fromIso: AUGUST.fromIso,
            toIso: AUGUST.toIso,
        })
        expect(save).toHaveBeenCalledWith(FILE)
        expect(onSaved).toHaveBeenCalledTimes(1)
        expect(result.current.isPrepared).toBe(false)
        const event = { format: 'csv', platform: 'web', range_preset: 'custom', range_days: 12 }
        expect(mockCapture).toHaveBeenCalledWith('activity_export_started', event)
        expect(mockCapture).toHaveBeenCalledWith('activity_export_saved', event)
    })

    it('sends no bounds for all time', async () => {
        const { result } = renderDownload({
            from: null,
            to: null,
            fromIso: undefined,
            toIso: undefined,
            preset: 'allTime',
        })
        await act(() => result.current.download())
        expect(prepare).toHaveBeenCalledWith({ format: 'csv', locale: 'es-AR', fromIso: undefined, toIso: undefined })
        expect(mockCapture).toHaveBeenCalledWith('activity_export_started', {
            format: 'csv',
            platform: 'web',
            range_preset: 'allTime',
            range_days: null,
        })
    })

    it('prepares on the first native tap and opens the share sheet on the second', async () => {
        native.mockReturnValue(true)
        const { result, onSaved } = renderDownload()

        await act(() => result.current.download())
        expect(prepare).toHaveBeenCalledTimes(1)
        expect(save).not.toHaveBeenCalled()
        expect(result.current.isPrepared).toBe(true)

        await act(() => result.current.download())
        expect(prepare).toHaveBeenCalledTimes(1)
        expect(save).toHaveBeenCalledWith(FILE)
        expect(onSaved).toHaveBeenCalledTimes(1)
        expect(result.current.isPrepared).toBe(false)
    })

    it('keeps the prepared file when the native share sheet is dismissed', async () => {
        native.mockReturnValue(true)
        save.mockResolvedValue('cancelled')
        const { result, onSaved } = renderDownload()

        await act(() => result.current.download())
        await act(() => result.current.download())
        expect(result.current.isPrepared).toBe(true)
        expect(onSaved).not.toHaveBeenCalled()
        expect(mockCapture).not.toHaveBeenCalledWith('activity_export_saved', expect.anything())
    })

    it('shows a period that is too long as a period error, not a flow error', async () => {
        prepare.mockRejectedValue(new StatementDownloadError('EXPORT_TOO_LARGE'))
        const { result } = renderDownload()
        await act(() => result.current.download())

        expect(result.current.periodTooLong).toBe(true)
        expect(result.current.error).toBeNull()
        expect(save).not.toHaveBeenCalled()
    })

    it('shows an unverified period as a flow error and reports which check refused it', async () => {
        prepare.mockRejectedValue(new StatementDownloadError('EXPORT_UNVERIFIED', 'reward-credit-missing'))
        const { result, onSaved } = renderDownload()
        await act(() => result.current.download())

        expect(result.current.error).toBe('unverified')
        expect(result.current.periodTooLong).toBe(false)
        expect(onSaved).not.toHaveBeenCalled()
        expect(mockCapture).toHaveBeenCalledWith('activity_export_failed', {
            format: 'csv',
            platform: 'web',
            range_preset: 'custom',
            range_days: 12,
            reason: 'EXPORT_UNVERIFIED',
            refusal: 'reward-credit-missing',
        })
    })

    it.each([
        ['EXPORT_BUSY', 'busy'],
        ['EXPORT_FAILED', 'failed'],
        ['INVALID_RANGE', 'failed'],
    ])('shows %s as the %s flow error', async (code, error) => {
        prepare.mockRejectedValue(new StatementDownloadError(code))
        const { result } = renderDownload()
        await act(() => result.current.download())
        expect(result.current.error).toBe(error)
    })

    it('shows a device that cannot save files as a flow error', async () => {
        native.mockReturnValue(true)
        save.mockRejectedValue(new StatementDownloadError('EXPORT_SAVE_UNAVAILABLE'))
        const { result } = renderDownload()
        await act(() => result.current.download())
        await act(() => result.current.download())
        expect(result.current.error).toBe('saveUnavailable')
    })

    it('drops a failure and a prepared file when the period or format changes', async () => {
        native.mockReturnValue(true)
        const { result, rerender, onSaved } = renderDownload()
        await act(() => result.current.download())
        expect(result.current.isPrepared).toBe(true)

        rerender({ format: 'xlsx', ...AUGUST, preset: undefined, onSaved })
        expect(result.current.isPrepared).toBe(false)

        prepare.mockRejectedValueOnce(new StatementDownloadError('EXPORT_BUSY'))
        await act(() => result.current.download())
        expect(result.current.error).toBe('busy')

        rerender({ format: 'xlsx', ...AUGUST, fromIso: '2026-08-04T03:00:00.000Z', preset: undefined, onSaved })
        expect(result.current.error).toBeNull()
    })

    it('ignores a second tap while a download is running', async () => {
        let finish: (file: typeof FILE) => void = () => {}
        prepare.mockReturnValue(new Promise<typeof FILE>((resolve) => (finish = resolve)))
        const { result } = renderDownload()

        let first: Promise<void> = Promise.resolve()
        act(() => {
            first = result.current.download()
        })
        expect(result.current.isDownloading).toBe(true)
        await act(() => result.current.download())
        expect(prepare).toHaveBeenCalledTimes(1)

        await act(async () => {
            finish(FILE)
            await first
        })
        expect(result.current.isDownloading).toBe(false)
        expect(save).toHaveBeenCalledTimes(1)
    })
})
