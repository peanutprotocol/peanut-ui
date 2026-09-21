import { CRISP_WEBSITE_ID } from '@/constants/crisp'

/**
 * The stock Crisp launcher — the floating bubble — belongs to the marketing
 * site only. The app has its own support drawer, which runs Crisp inside the
 * same-origin `/crisp-proxy` iframe.
 *
 * Marketing and the app share one root layout, so a client-side navigation
 * between them never reloads the document. `l.js` and the `.crisp-client`
 * element it appends to `document.body` live outside React, so unmounting the
 * marketing layout does not remove them: the bubble used to ride along on every
 * app screen for the rest of that document's life, covering the bottom-right
 * corner (2026-09-21, withdraw bank form).
 *
 * The functions below are the whole lifecycle. The marketing layout mounts one
 * component that shows the launcher on mount and hides it again on unmount, so
 * leaving marketing by any route always hides it and coming back shows it.
 */

const CRISP_SCRIPT_SRC = 'https://client.crisp.chat/l.js'

/**
 * Queue a command for Crisp.
 *
 * `$crisp` is a plain array until `l.js` loads and upgrades it in place, so a
 * command pushed before the script arrives is replayed once it does. Creating
 * the array when it is missing is what makes show/hide safe to call at any
 * point in the load, including from an effect that runs before the script tag.
 */
function pushCrisp(command: unknown[]): void {
    if (typeof window === 'undefined') return
    window.$crisp = window.$crisp || []
    window.$crisp.push(command)
}

/**
 * Load the Crisp chatbox into the main window, once per document.
 *
 * Re-entrant on purpose: React strict mode runs the mount effect twice, and a
 * second `l.js` would boot a second widget.
 */
export function loadCrispChatbox(): void {
    if (typeof window === 'undefined') return

    window.$crisp = window.$crisp || []
    window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID

    if (document.querySelector(`script[src="${CRISP_SCRIPT_SRC}"]`)) return

    const script = document.createElement('script')
    script.src = CRISP_SCRIPT_SRC
    script.async = true
    document.head.appendChild(script)
}

/** Show the launcher bubble. */
export function showCrispLauncher(): void {
    pushCrisp(['do', 'chat:show'])
}

/**
 * Hide the launcher bubble, and the chatbox with it.
 *
 * `chat:hide` alone leaves an open chatbox on screen, so a user who left
 * marketing mid-conversation would carry the panel into the app. Close first,
 * then hide.
 */
export function hideCrispLauncher(): void {
    pushCrisp(['do', 'chat:close'])
    pushCrisp(['do', 'chat:hide'])
}
