import * as Sentry from '@sentry/nextjs'
import { isAndroidNativeBridge } from '@/utils/capacitor'

/** How many "name (n).ext" names a save tries before it gives up on Documents. */
const MAX_NAME_ATTEMPTS = 100

/** "statement.pdf", then "statement (1).pdf", "statement (2).pdf", as Android's own downloads are named. */
function documentsFileName(fileName: string, attempt: number): string {
    if (attempt === 0) return fileName
    const dot = fileName.lastIndexOf('.')
    return dot > 0 ? `${fileName.slice(0, dot)} (${attempt})${fileName.slice(dot)}` : `${fileName} (${attempt})`
}

function toBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1])
        reader.onerror = () => reject(reader.error ?? new Error('Unable to read the file'))
        reader.readAsDataURL(blob)
    })
}

/**
 * Writes a file into the phone's public Documents folder, where the Files app
 * shows it. The app's Download buttons call this before they fall back to the
 * share sheet.
 *
 * Android only. On Android 11 and newer the app may write there, and read what
 * it wrote, with no permission. Android 10 and older need storage permissions
 * the app does not declare, so the write fails there. On iOS the app's own
 * Documents folder stays hidden from Files without native settings, so iOS is
 * never tried.
 *
 * `unavailable` means nothing was written: the caller opens the share sheet.
 */
export async function saveToDocuments(file: { blob: Blob; fileName: string }): Promise<'saved' | 'unavailable'> {
    // the JS ships over the air onto older binaries, which may lack the plugin
    if (!isAndroidNativeBridge() || !window.Capacitor?.isPluginAvailable?.('Filesystem')) return 'unavailable'
    try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        const data = await toBase64(file.blob)
        for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt++) {
            const path = documentsFileName(file.fileName, attempt)
            // writeFile replaces an existing file without a word, so a name that
            // is taken moves on to the next suffix
            const taken = await Filesystem.stat({ path, directory: Directory.Documents }).then(
                () => true,
                () => false
            )
            if (taken) continue
            await Filesystem.writeFile({ path, directory: Directory.Documents, data, recursive: true })
            return 'saved'
        }
        return 'unavailable'
    } catch (cause) {
        // expected on Android 10 and older; anywhere else it says the Documents save is broken
        Sentry.captureException(cause, { level: 'warning', tags: { feature: 'documents-save' } })
        return 'unavailable'
    }
}
