/**
 * Shared styling utilities for quest components
 */

export const getTierBadgeColorClasses = (color: string) => {
    switch (color) {
        case 'YELLOW':
            return 'bg-yellow-100 text-yellow-700'
        case 'PINK':
            return 'bg-pink-100 text-pink-700'
        case 'BLUE':
            return 'bg-blue-100 text-blue-700'
        default:
            return 'bg-gray-100 text-gray-700'
    }
}

export const getBackgroundColorClass = (bgColor: string) => {
    switch (bgColor) {
        case 'purple':
            return 'bg-purple-200'
        case 'pink':
            return 'bg-pink-100'
        case 'blue':
            return 'bg-blue-100'
        default:
            return 'bg-gray-100'
    }
}
