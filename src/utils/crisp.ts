import { type CrispUserData } from '@/hooks/useCrispUserData'

/**
 * Sets Crisp user data on a given $crisp instance
 * @param crispInstance - The $crisp object (either window.$crisp or iframe.contentWindow.$crisp)
 * @param userData - User data to set
 * @param prefilledMessage - Optional prefilled message
 */
export function setCrispUserData(crispInstance: any, userData: CrispUserData, prefilledMessage?: string): void {
    if (!crispInstance) return

    const { username, userId, email, grafanaLink } = userData

    // Set user nickname and email
    crispInstance.push(['set', 'user:nickname', [username || '']])
    crispInstance.push(['set', 'user:email', [email || '']])

    // Set session data - EXACT STRUCTURE (3 nested arrays!)
    crispInstance.push([
        'set',
        'session:data',
        [
            [
                ['username', username || ''],
                ['user_id', userId || ''],
                ['grafana_dashboard', grafanaLink || ''],
            ],
        ],
    ])

    // Set prefilled message if exists
    if (prefilledMessage) {
        crispInstance.push(['set', 'message:text', [prefilledMessage]])
    }
}
