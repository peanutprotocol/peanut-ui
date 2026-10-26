import { Filesystem } from '@capacitor/filesystem'
import * as Sentry from '@sentry/nextjs'
import { isAndroidNativeBridge } from '@/utils/capacitor'
import { saveToDocuments } from '../native-file.utils'

jest.mock('@/utils/capacitor', () => ({ isAndroidNativeBridge: jest.fn() }))
jest.mock('@capacitor/filesystem', () => ({
    Directory: { Documents: 'DOCUMENTS' },
    Filesystem: { stat: jest.fn(), writeFile: jest.fn() },
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))

const android = isAndroidNativeBridge as jest.Mock
const stat = Filesystem.stat as jest.Mock
const writeFile = Filesystem.writeFile as jest.Mock
const FILE = { blob: new Blob(['file']), fileName: 'peanut-activity_2026-08-01_2026-08-31.pdf' }
/** An app binary with (or without) the Filesystem plugin. */
const appShipsFilesystem = (available: boolean) => {
    window.Capacitor = { getPlatform: () => 'android', isPluginAvailable: () => available }
}
/** The names the Documents folder already holds. */
const documentsHold = (...names: string[]) =>
    stat.mockImplementation(async ({ path }: { path: string }) => {
        if (names.includes(path)) return { type: 'file', size: 4 }
        throw new Error('File does not exist')
    })

beforeEach(() => {
    jest.clearAllMocks()
    android.mockReturnValue(true)
    appShipsFilesystem(true)
    documentsHold()
    writeFile.mockResolvedValue({ uri: 'file:///storage/emulated/0/Documents/file' })
})
afterEach(() => {
    delete window.Capacitor
})

describe('saveToDocuments', () => {
    it('writes the file into the public Documents folder under its own name', async () => {
        expect(await saveToDocuments(FILE)).toBe('saved')
        // 'file' in base64
        expect(writeFile).toHaveBeenCalledWith({
            path: 'peanut-activity_2026-08-01_2026-08-31.pdf',
            directory: 'DOCUMENTS',
            data: 'ZmlsZQ==',
            recursive: true,
        })
    })

    it('never replaces a file that is already there: a taken name gets the next number', async () => {
        documentsHold('peanut-activity_2026-08-01_2026-08-31.pdf', 'peanut-activity_2026-08-01_2026-08-31 (1).pdf')
        expect(await saveToDocuments(FILE)).toBe('saved')
        expect(writeFile).toHaveBeenCalledTimes(1)
        expect(writeFile).toHaveBeenCalledWith(
            expect.objectContaining({ path: 'peanut-activity_2026-08-01_2026-08-31 (2).pdf' })
        )
    })

    it('numbers a name with no extension at its end', async () => {
        documentsHold('statement')
        await saveToDocuments({ blob: FILE.blob, fileName: 'statement' })
        expect(writeFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'statement (1)' }))
    })

    it('reports a failed write as unavailable, so the caller shares the file instead', async () => {
        // Android 10 and older: the app declares no storage permission
        writeFile.mockRejectedValue(new Error('User denied storage permission'))
        expect(await saveToDocuments(FILE)).toBe('unavailable')
        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), expect.anything())
    })

    it('writes nothing on iOS, on the web, or in an app built without the Filesystem plugin', async () => {
        android.mockReturnValue(false)
        expect(await saveToDocuments(FILE)).toBe('unavailable')

        android.mockReturnValue(true)
        appShipsFilesystem(false)
        expect(await saveToDocuments(FILE)).toBe('unavailable')

        expect(stat).not.toHaveBeenCalled()
        expect(writeFile).not.toHaveBeenCalled()
    })
})
