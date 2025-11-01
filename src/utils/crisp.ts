import { type CrispUserData } from '@/hooks/useCrispUserData'

/**
 * Sets Crisp user data on a given $crisp instance
 * @param crispInstance - The $crisp object (either window.$crisp or iframe.contentWindow.$crisp)
 * @param userData - User data to set
 * @param prefilledMessage - Optional prefilled message
 */
export function setCrispUserData(crispInstance: any, userData: CrispUserData, prefilledMessage?: string): void {
    if (!crispInstance) return

    const { username, userId, email, fullName, avatar, grafanaLink } = userData

    // Set user email - this is critical for session persistence across devices/browsers
    // According to Crisp docs, user:email is the primary identifier for session persistence
    if (email) {
        crispInstance.push(['set', 'user:email', [email]])
    }

    // Set user nickname - prefer fullName, fallback to username
    const nickname = fullName || username || ''
    if (nickname) {
        crispInstance.push(['set', 'user:nickname', [nickname]])
    }

    // Set user avatar if available
    if (avatar) {
        crispInstance.push(['set', 'user:avatar', [avatar]])
    }

    // Set session data - EXACT STRUCTURE (3 nested arrays!)
    // This metadata appears in Crisp dashboard for support agents
    crispInstance.push([
        'set',
        'session:data',
        [
            [
                ['username', username || ''],
                ['user_id', userId || ''],
                ['full_name', fullName || ''],
                ['grafana_dashboard', grafanaLink || ''],
            ],
        ],
    ])

    // Set prefilled message if exists
    if (prefilledMessage) {
        crispInstance.push(['set', 'message:text', [prefilledMessage]])
    }
}

/**
 * Resets Crisp session - call this on logout to prevent session merging
 * @param crispInstance - The $crisp object (window.$crisp or iframe.contentWindow.$crisp)
 */
export function resetCrispSession(crispInstance: any): void {
    if (!crispInstance || typeof window === 'undefined') return

    try {
        // Reset the session to prevent merging with next user's session
        crispInstance.push(['do', 'session:reset'])
    } catch (e) {
        console.debug('Could not reset Crisp session:', e)
    }
}
