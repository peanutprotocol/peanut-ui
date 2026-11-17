import type { SetupChrome, SetupFooterSecondary, SetupFooterSpec, SetupGround, SetupStageSize } from './shell.types'

/** What the screen on show tells the shell: the shell paints the seam, the top bar and the fixed footer from it. */
export type ShellScreenState = {
    owner: string
    ground: SetupGround
    stage: SetupStageSize
    chrome: SetupChrome
    footer: SetupFooterSpec | null
}

/**
 * A tiny external store between a screen and the shell. A screen writes on every render, and its footer callbacks
 * are new each time. The store notifies the shell only when something the shell draws changed; the footer calls
 * the latest callbacks through `latestFooter` at tap time. A write that changes nothing is a no-op, so a shell
 * render that re-renders the screen cannot loop.
 */
export type ShellStore = {
    get: () => ShellScreenState | null
    latestFooter: () => SetupFooterSpec | null
    set: (state: ShellScreenState) => void
    clear: (owner: string) => void
    subscribe: (listener: () => void) => () => void
}

const sameButton = (a: SetupFooterSecondary | undefined, b: SetupFooterSecondary | undefined) =>
    a === b ||
    (!!a &&
        !!b &&
        Object.is(a.label, b.label) &&
        a.disabled === b.disabled &&
        a.loading === b.loading &&
        a.icon === b.icon &&
        a.testId === b.testId &&
        a.small === b.small)

const sameFooter = (a: SetupFooterSpec | null, b: SetupFooterSpec | null) =>
    a === b ||
    (!!a &&
        !!b &&
        sameButton(a.primary, b.primary) &&
        sameButton(a.secondary, b.secondary) &&
        Object.is(a.slot, b.slot) &&
        Object.is(a.below, b.below) &&
        Object.is(a.reserve, b.reserve))

const sameState = (a: ShellScreenState | null, b: ShellScreenState) =>
    !!a &&
    a.owner === b.owner &&
    a.ground === b.ground &&
    a.stage === b.stage &&
    a.chrome.back === b.chrome.back &&
    a.chrome.dots === b.chrome.dots &&
    a.chrome.lang === b.chrome.lang &&
    sameFooter(a.footer, b.footer)

export function createShellStore(): ShellStore {
    let shown: ShellScreenState | null = null
    let latest: ShellScreenState | null = null
    const listeners = new Set<() => void>()
    const emit = () => listeners.forEach((listener) => listener())
    return {
        get: () => shown,
        latestFooter: () => latest?.footer ?? null,
        set: (next) => {
            latest = next
            if (sameState(shown, next)) return
            shown = next
            emit()
        },
        clear: (owner) => {
            if (latest?.owner !== owner) return
            latest = null
            shown = null
            emit()
        },
        subscribe: (listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
    }
}
