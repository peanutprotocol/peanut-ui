import type { SetupChrome, SetupFooterSpec, SetupGround, SetupStageSize } from './shell.types'

/** What the screen on show tells the shell: the shell paints the seam, the top bar and the fixed footer from it. */
export type ShellScreenState = {
    owner: string
    ground: SetupGround
    stage: SetupStageSize
    chrome: SetupChrome
    footer: SetupFooterSpec | null
}

/**
 * A tiny external store between a screen and the shell. A screen writes its footer on every render (the
 * callbacks change each time); only the shell parts that read the store re-render, never the screen, so the
 * writes cannot loop.
 */
export type ShellStore = {
    get: () => ShellScreenState | null
    set: (state: ShellScreenState) => void
    clear: (owner: string) => void
    subscribe: (listener: () => void) => () => void
}

export function createShellStore(): ShellStore {
    let state: ShellScreenState | null = null
    const listeners = new Set<() => void>()
    const emit = () => listeners.forEach((listener) => listener())
    return {
        get: () => state,
        set: (next) => {
            state = next
            emit()
        },
        clear: (owner) => {
            if (state?.owner !== owner) return
            state = null
            emit()
        },
        subscribe: (listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
    }
}
