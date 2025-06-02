/**
 * @fileoverview utility functions for generating colors based on strings (e.g., usernames).
 */

// NOTE: using hex codes cuz tailwind classes works weird with dynamic colors and doesnt really apply all the time, even when using twMerge
const COLORS_MAPPING = {
    peanut_pink: {
        lightShade: '#FFD5F6',
        darkShade: '#FF74E2',
    },
    yellow: {
        lightShade: '#FFEA9A',
        darkShade: '#FFC900',
    },
    purple: {
        lightShade: '#E2D9FF',
        darkShade: '#795CD3',
    },
    cyan: {
        lightShade: '#C3E8F2',
        darkShade: '#00A5D1',
    },
    red: {
        lightShade: '#FFC2C2',
        darkShade: '#FF0101',
    },
    orange: {
        lightShade: '#FFD3B4',
        darkShade: '#FF6B00',
    },
    green: {
        lightShade: '#AAFFA7',
        darkShade: '#00CC51',
    },
}

// specific colors for different avatar types/contexts
export const AVATAR_LINK_BG = '#FF90E8' // peanut pink for links
export const AVATAR_WALLET_BG = COLORS_MAPPING.yellow.darkShade // yellow for address/non-user/add/withdraw header
export const AVATAR_DARK_BG = '#000000' // black for add/withdraw card context

// text/icon colors
export const AVATAR_TEXT_LIGHT = '#FFFFFF' // white
export const AVATAR_TEXT_DARK = '#000000' // black

/**
 * Generates a deterministic background color from a predefined list based on a username.
 * @param username The username string.
 * @returns An object with { darkShade, lightShade }
 */
export function getColorForUsername(username?: string): { darkShade: string; lightShade: string } {
    const colors = Object.values(COLORS_MAPPING)
    if (!username) {
        // default colors if no username is provided
        return { darkShade: colors[1].darkShade, lightShade: colors[1].lightShade } // Default to yellow bg, black text
    }

    let hash = 0
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash)
        hash = hash & hash
    }

    const index = Math.abs(hash) % colors.length
    const darkShade = colors[index].darkShade
    const lightShade = colors[index].lightShade

    return { darkShade, lightShade }
}
