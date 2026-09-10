import { isNativeBridge } from './capacitor'

function platform(): string | undefined {
    return window.Capacitor?.getPlatform?.()
}

function hasPlugin(): boolean {
    return !!window.Capacitor?.isPluginAvailable?.('NativeSettings')
}

/**
 * Whether this install can deep-link to the app's own OS settings page.
 *
 * capacitor-native-settings is native code, so an OTA'd bundle can land on a
 * binary that predates it — hence the feature check rather than a bare
 * isNativeBridge(). iOS still answers true without it: Capacitor hands any
 * top-level navigation it doesn't own to UIApplication.open, which resolves
 * `app-settings:` (WebViewDelegationHandler.decidePolicyFor). Android has no
 * such escape — Bridge.launchIntent fires ACTION_VIEW on the raw URI and never
 * parses an `intent://`, so there the plugin is the only route.
 */
export function canOpenAppSettings(): boolean {
    if (!isNativeBridge()) return false
    return hasPlugin() || platform() === 'ios'
}

export async function openAppSettings(): Promise<boolean> {
    if (!isNativeBridge()) return false

    if (hasPlugin()) {
        try {
            const { NativeSettings, AndroidSettings, IOSSettings } = await import('capacitor-native-settings')
            // IOSSettings.App is the one app-settings URL Apple sanctions; the
            // plugin's other options are private `App-prefs:` paths.
            const { status } = await NativeSettings.open({
                optionAndroid: AndroidSettings.ApplicationDetails,
                optionIOS: IOSSettings.App,
            })
            if (status) return true
        } catch (err) {
            console.warn('NativeSettings.open failed:', err)
        }
    }

    if (platform() === 'ios') {
        window.location.href = 'app-settings:'
        return true
    }

    return false
}
