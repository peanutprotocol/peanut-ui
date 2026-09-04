import { nativeCapability } from './native-capability'

interface ClipboardDetectPlugin {
    hasStrings(): Promise<{ value: boolean }>
    hasProbableWebUrl(): Promise<{ value: boolean }>
}

// App-local iOS plugin (ios/App/App/ClipboardDetectPlugin.swift); no web/Android
// implementation exists — callers must treat "unavailable" as false.
const ClipboardDetect = nativeCapability<ClipboardDetectPlugin>('ClipboardDetect', { platforms: ['ios'] })

/**
 * iOS-native only: prompt-free "is there text on the clipboard?" check via
 * UIPasteboard.hasStrings — metadata only, so it never raises the iOS 16+
 * "Allow Paste" alert the way an un-gestured Clipboard.read() does. Returns
 * false on every other platform and on older binaries without the plugin
 * (OTA'd JS), so the caller simply doesn't offer the paste shortcut there.
 */
export async function clipboardHasStrings(): Promise<boolean> {
    return ClipboardDetect.call(
        async (plugin) => (await plugin.hasStrings()).value,
        () => false
    )
}

/**
 * iOS-native only: prompt-free "does the clipboard probably contain a web
 * url?" via UIPasteboard.detectPatterns — pattern confidence only, content is
 * never read, so no paste alert. Gates the deferred-deep-link clipboard read
 * (the hand-off is always a url) so unrelated clipboard text never triggers
 * the prompt. False on other platforms and binaries without the method.
 */
export async function clipboardHasProbableWebUrl(): Promise<boolean> {
    return ClipboardDetect.call(
        async (plugin) => (await plugin.hasProbableWebUrl()).value,
        () => false
    )
}
