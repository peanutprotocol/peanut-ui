import { registerPlugin } from '@capacitor/core'
import { isIOSNative } from './capacitor'

interface ClipboardDetectPlugin {
    hasStrings(): Promise<{ value: boolean }>
}

// App-local iOS plugin (ios/App/App/ClipboardDetectPlugin.swift); no web/Android
// implementation exists — callers must treat "unavailable" as false.
const ClipboardDetect = registerPlugin<ClipboardDetectPlugin>('ClipboardDetect')

/**
 * iOS-native only: prompt-free "is there text on the clipboard?" check via
 * UIPasteboard.hasStrings — metadata only, so it never raises the iOS 16+
 * "Allow Paste" alert the way an un-gestured Clipboard.read() does. Returns
 * false on every other platform and on older binaries without the plugin
 * (OTA'd JS), so the caller simply doesn't offer the paste shortcut there.
 */
export async function clipboardHasStrings(): Promise<boolean> {
    if (!isIOSNative()) return false
    try {
        const { value } = await ClipboardDetect.hasStrings()
        return value
    } catch {
        return false
    }
}
