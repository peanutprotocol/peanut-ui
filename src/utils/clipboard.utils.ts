import { isNativeBridge } from '@/utils/capacitor'
import * as Sentry from '@/utils/sentry-lazy'

const CLIPBOARD_WRITE_TIMEOUT_MS = 1000

const describeError = (err: unknown) => (err instanceof Error ? `${err.name}: ${err.message}` : String(err))

/**
 * Copies text to the clipboard, reporting whether it actually landed.
 *
 * Native goes through the Capacitor plugin first: the WebView's
 * navigator.clipboard write is gated on a live user activation, which an await
 * on a network call (creating a link, say) has usually already spent.
 *
 * On the web, writeText is raced against a timeout (Brave iOS never settles
 * it) and a rejection or a hang falls through to the legacy execCommand path.
 * A copy that fails every path is captured to Sentry once, naming the methods
 * that failed; the text itself never is.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
    const failed: Record<string, string> = {}

    if (isNativeBridge()) {
        try {
            const { Clipboard } = await import('@capacitor/clipboard')
            await Clipboard.write({ string: text })
            return true
        } catch (err) {
            failed.nativePlugin = describeError(err)
        }
    }

    if (navigator.clipboard && window.isSecureContext) {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
            await Promise.race([
                navigator.clipboard.writeText(text),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(
                        () => reject(new Error('navigator.clipboard.writeText timed out')),
                        CLIPBOARD_WRITE_TIMEOUT_MS
                    )
                }),
            ])
            return true
        } catch (err) {
            failed.clipboardApi = describeError(err)
        } finally {
            clearTimeout(timer)
        }
    }

    // Fallback for older browsers, and for a Clipboard API that rejected or hung
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.setAttribute('readonly', '')
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    try {
        textArea.focus()
        textArea.select()
        if (document.execCommand('copy')) return true
        failed.execCommand = 'returned false'
    } catch (err) {
        failed.execCommand = describeError(err)
    } finally {
        textArea.remove()
    }

    Sentry.captureException(new Error('Clipboard copy failed'), { extra: { failed } })
    return false
}

/**
 * A clipboard write reserved inside a click, for text that only exists after an
 * await. Settle it exactly once: `resolve` with the text, or `cancel` when the
 * text never arrives — an unsettled reservation leaves the write hanging.
 */
export interface PendingClipboardCopy {
    resolve: (text: string) => Promise<boolean>
    cancel: () => void
}

/**
 * Reserves the clipboard for text that is still being fetched. MUST be called
 * synchronously from the event handler, before the first await.
 *
 * WebKit only allows a clipboard write while the user activation from the click
 * is still live, and awaiting the request that mints the link spends it — so a
 * plain writeText afterwards is rejected on Safari and iOS PWAs. Handing
 * ClipboardItem a promise instead starts the write inside the gesture and lets
 * the text land later. Everything else falls back to a plain post-await copy.
 */
export function beginClipboardCopy(): PendingClipboardCopy {
    const canReserve =
        !isNativeBridge() &&
        typeof ClipboardItem !== 'undefined' &&
        typeof navigator.clipboard?.write === 'function' &&
        window.isSecureContext

    if (!canReserve) {
        return { resolve: copyTextToClipboard, cancel: () => {} }
    }

    let settle: (blob: Blob | PromiseLike<Blob>) => void = () => {}
    let abandon: (reason: Error) => void = () => {}
    const blob = new Promise<Blob>((res, rej) => {
        settle = res
        abandon = rej
    })
    // cancel()'s rejection is reported through `reserved`, never as an unhandled one
    blob.catch(() => {})

    // started here, inside the gesture; the text arrives later
    const reserved = navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]).then(
        () => true,
        (err) => {
            console.error('Failed to copy: ', err)
            return false
        }
    )

    return {
        resolve: async (text: string) => {
            settle(new Blob([text], { type: 'text/plain' }))
            // a rejected reservation still leaves the ordinary path worth a try
            return (await reserved) || copyTextToClipboard(text)
        },
        cancel: () => {
            abandon(new Error('Clipboard copy abandoned'))
            void reserved
        },
    }
}
