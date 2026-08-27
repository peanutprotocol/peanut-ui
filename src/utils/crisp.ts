import { type CrispUserData } from '@/hooks/useCrispUserData'
import { isCapacitor } from '@/utils/capacitor'
import { CRISP_WEBSITE_ID } from '@/constants/crisp'

type CrispInstance = Window['$crisp']

type NativeCrisp = typeof import('@capgo/capacitor-crisp').CapacitorCrisp

let nativeCrispReady: Promise<{ CapacitorCrisp: NativeCrisp }> | null = null

/**
 * Lazily loads and configures the native Crisp SDK, memoized across calls.
 * Configuration happens on first support open rather than app launch — the
 * SDK init is part of the native startup burst we keep off the boot path.
 *
 * Resolves with the plugin wrapped in an object, never with the plugin itself:
 * settling a promise with a value probes its .then, and Capacitor's plugin
 * proxy answers that probe with a "CapacitorCrisp.then()" method wrapper. The
 * wrapper never invokes the resolve/reject callbacks it is handed, so the
 * promise stays pending forever — support opens to a blank panel and not even
 * the .catch runs.
 */
export function ensureNativeCrispConfigured(): Promise<{ CapacitorCrisp: NativeCrisp }> {
    if (!nativeCrispReady) {
        nativeCrispReady = import('@capgo/capacitor-crisp').then(async ({ CapacitorCrisp }) => {
            await CapacitorCrisp.configure({ websiteID: CRISP_WEBSITE_ID })
            return { CapacitorCrisp }
        })
        // allow a retry on next open if configure fails
        nativeCrispReady.catch(() => {
            nativeCrispReady = null
        })
    }
    return nativeCrispReady
}

/**
 * The support-agent sidebar, as ordered key/value rows.
 *
 * ONE definition feeds every sink — the web widget's `session:data`, the proxy
 * iframe (which receives the whole `CrispUserData` object and calls
 * `setCrispUserData`), and the native `setString` loop. They used to be written
 * out by hand per sink and had already drifted: native sent two keys where web
 * sent seven, so the agents helping *app* users saw the least.
 *
 * Values are always present, empty string when absent, so a previous user's
 * value can never linger on a device-local Crisp session.
 */
export function supportSessionFields(userData: CrispUserData, supportTopic?: string): Array<[string, string]> {
    const { emailOnFile } = userData
    return [
        ['username', userData.username || ''],
        ['user_id', userData.userId || ''],
        ['full_name', userData.fullName || ''],
        ['wallet_address', userData.walletAddressLink || ''],
        ['bridge_user_id', userData.bridgeCustomerLink || ''],
        ['manteca_user_id', userData.mantecaUserId || ''],
        ['posthog_person', userData.posthogPersonLink || ''],
        ['sentry_issues', userData.sentryIssuesLink || ''],
        ['identity_status', userData.identityStatus || ''],
        ['email_on_file', emailOnFile === undefined ? '' : emailOnFile ? 'yes' : 'no'],
        ['verification_gates', userData.verificationGates || ''],
        ['verification_rails', userData.verificationRails || ''],
        ['failure_reason', userData.failureReason || ''],
        ['pending_actions', userData.pendingActions || ''],
        ['balance', userData.balance || ''],
        ['account_stats', userData.accountStats || ''],
        ['card', userData.card || ''],
        ['linked_accounts', userData.linkedAccounts || ''],
        ['app_context', userData.appContext || ''],
        ['segments', (userData.segments ?? []).join(' ')],
        /*
         * Why the prefill is a data row and not only the composer text.
         *
         * On web the prefill populates the user's composer and reaches the agent
         * as a message. On native it cannot: `sendMessage` is `unimplemented` in
         * this plugin on BOTH iOS and Android, so every "contact support about X"
         * entry point lost its context in the app — silently, and with an
         * unhandled rejection behind it. Carrying the topic here delivers it
         * through a method both platforms actually implement, and on web it
         * survives the user deleting the prefilled text before sending.
         */
        ['support_topic', supportTopic || ''],
    ]
}

/**
 * Same rows, for the native SDK's one-key-at-a-time `setString`.
 *
 * `segments` is a data row on native rather than real segments: the native SDK
 * holds a single segment (assignment, not append), so the list would collapse
 * to whichever call ran last. The primary one is set separately by the caller.
 */
export const nativeCrispFields = supportSessionFields

/**
 * Sets Crisp user identification and session metadata on a $crisp instance
 *
 * This is used for the main window Crisp widget (not iframe).
 * Sets user email (critical for session persistence), nickname, avatar,
 * and session metadata visible to support agents.
 *
 * @param crispInstance - The $crisp object (window.$crisp)
 * @param userData - User data to set
 * @param prefilledMessage - Optional message to prefill in chat
 */
export function setCrispUserData(
    crispInstance: CrispInstance,
    userData: CrispUserData,
    prefilledMessage?: string,
    /*
     * The topic as metadata, separate from the composer text above it.
     * A routine metadata refresh deliberately omits `prefilledMessage` so it
     * cannot overwrite what the user is typing — but the sidebar row must
     * survive that refresh, or a balance update erases the reason they opened
     * support. Defaults to the composer value for callers that have only one.
     */
    supportTopic: string | undefined = prefilledMessage
): void {
    if (!crispInstance) return

    const { username, email, fullName, avatar } = userData

    if (email) {
        crispInstance.push(['set', 'user:email', [email]])
    }

    const nickname = fullName || username || ''
    if (nickname) {
        crispInstance.push(['set', 'user:nickname', [nickname]])
    }

    if (avatar) {
        crispInstance.push(['set', 'user:avatar', [avatar]])
    }

    // Session metadata for support agents - must be 3 levels of nested arrays
    crispInstance.push(['set', 'session:data', [supportSessionFields(userData, supportTopic)]])

    /*
     * The app does NOT write Crisp segments. Deliberate — do not add it back.
     *
     * Segments are a field people write by hand, and one of them backs an OKR:
     * agents tag translation reports `translation-issue`, and the monthly count
     * only sees a conversation that still carries the tag
     * (mono/ops/playbook/translation-issue-tag.md). Ops tags incidents the same
     * way. Crisp has no partial write — a set replaces the whole list — so any
     * automatic write erases whatever a human put there, and this runs on every
     * snapshot change, not just on open.
     *
     * Appending instead is not the answer either: the app's own flags then go
     * stale, and a user who was briefly offline routes as `offline` for good.
     *
     * The flags still reach the agent, as the `segments` row in the sidebar
     * above. What the app gives up is filtering the inbox by its own state,
     * which has never existed. See TASK-21968.
     */

    if (prefilledMessage) {
        crispInstance.push(['set', 'message:text', [prefilledMessage]])
    }
}

/**
 * Resets Crisp session to prevent session merging between users
 *
 * @param crispInstance - The $crisp object
 */
export function resetCrispSession(crispInstance: CrispInstance): void {
    if (!crispInstance || typeof window === 'undefined') return

    try {
        // Clear CRISP_TOKEN_ID before resetting session to fully unbind the user.
        // This prevents the next anonymous session from inheriting the previous user's conversation.
        // @see https://docs.crisp.chat/guides/chatbox-sdks/web-sdk/session-continuity/
        window.CRISP_TOKEN_ID = null

        crispInstance.push(['do', 'session:reset'])
    } catch (e) {
        console.debug('[Crisp] Could not reset session:', e)
    }
}

/**
 * Resets all Crisp sessions on logout (main window + proxy iframes)
 *
 * Attempts to reset currently mounted proxy iframes via postMessage,
 * and sets a sessionStorage flag for proxy pages that aren't currently mounted.
 */
export function resetCrispProxySessions(): void {
    if (typeof window === 'undefined') return

    // in capacitor, reset via native plugin — only if it was ever configured
    // this session (i.e. support was opened); nothing to reset otherwise
    if (isCapacitor()) {
        if (nativeCrispReady) {
            nativeCrispReady
                .then(({ CapacitorCrisp }) => CapacitorCrisp.reset())
                .catch((err) => console.debug('[Crisp] native reset failed:', err))
        }
        return
    }

    try {
        const iframes = document.querySelectorAll('iframe[src*="crisp-proxy"]')

        iframes.forEach((iframe) => {
            try {
                const iframeWindow = (iframe as HTMLIFrameElement).contentWindow
                if (iframeWindow) {
                    iframeWindow.postMessage(
                        {
                            type: 'CRISP_RESET_SESSION',
                        },
                        window.location.origin
                    )
                }
            } catch (e) {
                console.debug('[Crisp] Could not reset proxy iframe:', e)
            }
        })

        if (window.$crisp) {
            resetCrispSession(window.$crisp)
        }

        // Flag for proxy pages that aren't currently mounted
        sessionStorage.setItem('crisp_needs_reset', 'true')
    } catch (e) {
        console.debug('[Crisp] Could not reset proxy sessions:', e)
    }
}
