import { isNativeBridge } from '@/utils/capacitor'

/**
 * Copies text to the clipboard, reporting whether it actually landed.
 *
 * Native goes through the Capacitor plugin first: the WebView's
 * navigator.clipboard write is gated on a live user activation, which an await
 * on a network call (creating a link, say) has usually already spent.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
    if (isNativeBridge()) {
        try {
            const { Clipboard } = await import('@capacitor/clipboard')
            await Clipboard.write({ string: text })
            return true
        } catch (err) {
            console.error('Failed to copy: ', err)
        }
    }

    let textArea: HTMLTextAreaElement | undefined

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text)
            return true
        } else {
            // Fallback for older browsers
            textArea = document.createElement('textarea')
            textArea.value = text
            textArea.style.position = 'fixed'
            textArea.style.left = '-999999px'
            textArea.style.top = '-999999px'
            document.body.appendChild(textArea)
            textArea.focus()
            textArea.select()
            return document.execCommand('copy')
        }
    } catch (err) {
        console.error('Failed to copy: ', err)
        return false
    } finally {
        textArea?.remove()
    }
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
