/**
 * @fileoverview utility functions for generating colors based on strings (e.g., usernames).
 */

// NOTE: using hex codes cuz tailwind classes works weird with dynamic colors and doesnt really apply all the time, even when using twMerge
const COLORS_MAPPING = {
    peanut_pink: '#FF90E8', // peanut pink
    yellow: '#FFC900', // yellow
    purple: '#9D7EFE', // purple
    cyan: '#4CCCEF', // cyan
    red: '#FF4A4A', // red
    orange: '#FE8E3E', // orange
    green: '#29CC6A', // green
}

// specific colors for different avatar types/contexts
export const AVATAR_LINK_BG = COLORS_MAPPING.peanut_pink // peanut pink for links
export const AVATAR_WALLET_BG = COLORS_MAPPING.yellow // yellow for address/non-user/add/withdraw header
export const AVATAR_DARK_BG = '#000000' // black for add/withdraw card context

// text/icon colors
export const AVATAR_TEXT_LIGHT = '#FFFFFF' // white
export const AVATAR_TEXT_DARK = '#000000' // black

/**
 * Generates a deterministic background color from a predefined list based on a username.
 * @param username The username string.
 * @returns An object with { backgroundColor }
 */
export function getColorForUsername(username?: string): { backgroundColor: string } {
    const colors = Object.values(COLORS_MAPPING)
    if (!username) {
        // default colors if no username is provided
        return { backgroundColor: colors[1] } // Default to yellow bg, black text
    }

    let hash = 0
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash)
        hash = hash & hash
    }

    const index = Math.abs(hash) % colors.length
    const backgroundColor = colors[index]

    return { backgroundColor }
}
