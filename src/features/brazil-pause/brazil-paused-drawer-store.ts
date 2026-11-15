/*
 * The one drawer that says why a Pix payment or a Pix-key send does not start
 * (the app layout renders it), and what it says: the Brazil pause, or a
 * residence the pay route does not serve. Any entry opens it with
 * `openBrazilPausedDrawer(block)`, so no screen carries a copy of the drawer.
 */
import type { PixPayBlock } from '@/features/pix/pixRoute.utils'

let block: PixPayBlock | null = null
const listeners = new Set<() => void>()

function set(next: PixPayBlock | null) {
    if (block === next) return
    block = next
    listeners.forEach((listener) => listener())
}

export const openBrazilPausedDrawer = (next: PixPayBlock) => set(next)
export const closeBrazilPausedDrawer = () => set(null)
export const brazilPausedDrawerBlock = () => block
export const isBrazilPausedDrawerOpen = () => block !== null

export function subscribeBrazilPausedDrawer(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}
