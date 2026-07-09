import { isCapacitor } from '@/utils/capacitor'
import type { ResolvedTheme } from '@/utils/theme'

// body background per theme (light: bg-background #FAF4F0, dark: dark:bg-n-2 #161616)
const STATUS_BAR_BG: Record<ResolvedTheme, string> = {
    light: '#FAF4F0',
    dark: '#161616',
}

/**
 * Matches the native status bar to the app theme. Capacitor `Style.Light` means
 * a light background with dark text and `Style.Dark` the inverse, so they map to
 * the opposite of the theme name. No-op off native. Plugin is dynamically
 * imported because it only exists in native builds.
 */
export async function syncNativeStatusBar(theme: ResolvedTheme): Promise<void> {
    if (!isCapacitor()) return
    try {
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        await StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light })
        await StatusBar.setBackgroundColor({ color: STATUS_BAR_BG[theme] })
    } catch (e) {
        console.warn('failed to sync status bar theme:', e)
    }
}
