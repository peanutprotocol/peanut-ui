/**
 * @fileoverview utility functions for generating colors based on strings (e.g., usernames).
 */

// NOTE: using hex codes cuz tailwind classes works weird with dynamic colors and doesnt really apply all the time, even when using twMerge
const USER_AVATAR_COLORS = [
    '#FF90E8', // Pink
    '#FFC900', // Yellow
    '#9D7EFE', // Purple
    '#4CCCEF', // Cyan
    '#FF4A4A', // Red
    '#FE8E3E', // Orange
    '#29CC6A', // Green
]

/**
 * Generates a deterministic background color from a predefined list based on a username.
 * @param username The username string.
 * @returns An object with { backgroundColor }
 */
export function getColorForUsername(username?: string): { backgroundColor: string } {
    if (!username) {
        // default colors if no username is provided
        return { backgroundColor: USER_AVATAR_COLORS[1] } // Default to yellow bg, black text
    }

    let hash = 0
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash)
        hash = hash & hash
    }

    const index = Math.abs(hash) % USER_AVATAR_COLORS.length
    const backgroundColor = USER_AVATAR_COLORS[index]

    return { backgroundColor }
}
