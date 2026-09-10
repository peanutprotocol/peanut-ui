/**
 * LIFO stack of back handlers. Overlays and in-page sub-views register while
 * they are showing; dispatch walks the stack top-down and only falls through
 * to history navigation when no handler consumed it. Registration happens on
 * every platform. Two things dispatch: the native backButton listener (on
 * Capacitor) and the setup flow's visible back button (every platform), so
 * both back paths share one semantics.
 */
export type BackHandler = () => boolean

type Entry = { handler: BackHandler }

const stack: Entry[] = []

export function registerBackHandler(handler: BackHandler): () => void {
    const entry: Entry = { handler }
    stack.push(entry)
    return () => {
        const index = stack.indexOf(entry)
        if (index !== -1) stack.splice(index, 1)
    }
}

export function dispatchBackPress(): boolean {
    for (let i = stack.length - 1; i >= 0; i--) {
        try {
            if (stack[i].handler()) return true
        } catch (e) {
            console.warn('back handler threw:', e)
        }
    }
    return false
}

export function resetBackHandlersForTests(): void {
    stack.length = 0
}
