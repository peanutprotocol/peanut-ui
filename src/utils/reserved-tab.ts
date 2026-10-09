/**
 * Reserves a blank tab inside the click's user-activation window, detached from
 * this signed-in tab so the provider page it later loads can't navigate us
 * (reverse tabnabbing). `noopener` would make window.open return null, so the
 * opener is cut by hand. WebKit can hand back an already cross-origin proxy
 * whose opener write throws (PEANUT-UI-TCR): that tab can't be detached, so it
 * is closed and the caller falls back to same-tab navigation.
 */
export function reserveDetachedTab(): Window | null {
    const tab = window.open('', '_blank')
    if (!tab) return null
    try {
        tab.opener = null
        return tab
    } catch {
        tab.close()
        return null
    }
}
