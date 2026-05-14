/**
 * Pink-banner console.log helper used by the localhost-only debug surfaces:
 *   - `src/context/PeanutDebug.tsx` (window.debug + window.cheats helpers)
 *   - `src/app/(mobile-ui)/dev/debug/page.tsx` (the /dev/debug panel)
 *
 * Pink (#FF90E8 — `purple-1`/`primary-1` despite the misleading name) is
 * the brand pink. Banner makes debug output stand out from app logs in
 * DevTools.
 */

const PINK = '#FF90E8'
const BANNER_STYLE = `background:${PINK};color:#000;padding:2px 6px;border-radius:2px;font-weight:bold`
const TEXT_STYLE = `color:${PINK};font-weight:bold`

export function debugLog(label: string, ...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.log(`%c[debug]%c ${label}`, BANNER_STYLE, TEXT_STYLE, ...args)
}
