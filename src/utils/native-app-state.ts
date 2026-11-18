/**
 * Calls `onChange` on Capacitor's `appStateChange` until the returned stop runs.
 *
 * On Android the event reports false only from the activity's onStop, when no part of the app is
 * visible (BridgeActivity.onStop), and true from every onResume. A translucent sheet over the app,
 * such as the Credential Manager passkey sheet, only pauses the activity, so it does not report false.
 */
export function watchNativeAppActive(onChange: (isActive: boolean) => void): () => void {
    let stopped = false
    let remove: (() => void) | undefined
    void import('@capacitor/app')
        .then(({ App }) =>
            App.addListener('appStateChange', ({ isActive }) => {
                if (!stopped) onChange(isActive)
            })
        )
        .then((handle) => {
            if (stopped) void handle.remove()
            else remove = () => void handle.remove()
        })
        .catch(() => {})
    return () => {
        stopped = true
        remove?.()
    }
}
