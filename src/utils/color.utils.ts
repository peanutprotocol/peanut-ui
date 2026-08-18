/**
 * @fileoverview utility functions for generating colors based on strings (e.g., usernames).
 */

// NOTE: using hex codes cuz tailwind classes works weird with dynamic colors and doesnt really apply all the time, even when using twMerge
// values = the avatar board triplets (17802:61529): lightShade=bg, borderShade=border, darkShade=foreground
const COLORS_MAPPING = {
    peanut_pink: {
        lightShade: '#FFD5F6',
        borderShade: '#E06AC8',
        darkShade: '#A42089',
    },
    yellow: {
        lightShade: '#FAE184',
        borderShade: '#DCAE01',
        darkShade: '#885B00',
    },
    purple: {
        lightShade: '#DCD6FF',
        borderShade: '#BA8BFF',
        darkShade: '#9333EA',
    },
    blue: {
        lightShade: '#DBEAFE',
        borderShade: '#90A8ED',
        darkShade: '#2563EB',
    },
    red: {
        lightShade: '#FFCCCC',
        borderShade: '#EA8282',
        darkShade: '#E40C0C',
    },
    orange: {
        lightShade: '#FFD3B4',
        borderShade: '#F69855',
        darkShade: '#B8450A',
    },
    green: {
        lightShade: '#C7F9C6',
        borderShade: '#29CC6A',
        darkShade: '#3B730C',
    },
}

// specific colors for different avatar types/contexts
export const AVATAR_LINK_BG = '#FF90E8' // peanut pink for links
export const AVATAR_WALLET_BG = '#FFC900' // yellow for address/non-user/add/withdraw header (action/secondary token)

// text/icon colors
export const AVATAR_TEXT_LIGHT = '#FFFFFF' // white
export const AVATAR_TEXT_DARK = '#000000' // black

/**
 * Generates a deterministic background color from a predefined list based on a username.
 * @param username The username string.
 * @returns An object with { darkShade, lightShade }
 */
export function getColorForUsername(username?: string): {
    darkShade: string
    lightShade: string
    borderShade: string
} {
    const colors = Object.values(COLORS_MAPPING)
    if (!username) {
        // default colors if no username is provided
        return colors[1] // default to yellow
    }

    let hash = 0
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash)
        hash = hash & hash
    }

    return colors[Math.abs(hash) % colors.length]
}
