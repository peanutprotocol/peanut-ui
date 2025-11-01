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
