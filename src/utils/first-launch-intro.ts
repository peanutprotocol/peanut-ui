import { isNativeBridge } from '@/utils/capacitor'
import { writeStoredValue } from '@/utils/safe-storage'

export const FIRST_LAUNCH_INTRO_KEY = 'peanut_first_launch_intro_v1'

/** Logout is a returning-user entry, even if this install first opened signed in. */
export async function markFirstLaunchIntroSeen(): Promise<void> {
    writeStoredValue(FIRST_LAUNCH_INTRO_KEY, '1')
    if (!isNativeBridge()) return
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
        // Persist before logout reloads the WebView. A broken native bridge must
        // not hold logout indefinitely; localStorage is already updated above.
        await Promise.race([
            import('@capacitor/preferences').then(({ Preferences }) =>
                Preferences.set({ key: FIRST_LAUNCH_INTRO_KEY, value: '1' })
            ),
            new Promise<void>((resolve) => {
                timeout = setTimeout(resolve, 700)
            }),
        ])
    } catch {
        // Decorative state must never prevent logout.
    } finally {
        clearTimeout(timeout)
    }
}
