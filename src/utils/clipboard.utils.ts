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
