/*
 * Open state of the one Brazil paused drawer, which the app layout renders.
 * Any Brazil entry opens it with `openBrazilPausedDrawer()`, so no screen
 * carries a copy of the drawer.
 */

let open = false
const listeners = new Set<() => void>()

function set(next: boolean) {
    if (open === next) return
    open = next
    listeners.forEach((listener) => listener())
}

export const openBrazilPausedDrawer = () => set(true)
export const closeBrazilPausedDrawer = () => set(false)
export const isBrazilPausedDrawerOpen = () => open

export function subscribeBrazilPausedDrawer(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}
