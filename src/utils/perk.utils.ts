/**
 * Utility functions for perk claiming and UI effects
 */

export type ShakeIntensity = 'none' | 'weak' | 'medium' | 'strong' | 'intense'

/**
 * Get the CSS class name for the shake animation based on intensity
 * @param isShaking - Whether the shake animation is active
 * @param shakeIntensity - The intensity level of the shake
 * @returns CSS class name for the shake animation
 */
export function getShakeClass(isShaking: boolean, shakeIntensity: ShakeIntensity): string {
    if (!isShaking) return ''
    switch (shakeIntensity) {
        case 'weak':
            return 'perk-shake-weak'
        case 'medium':
            return 'perk-shake-medium'
        case 'strong':
            return 'perk-shake-strong'
        case 'intense':
            return 'perk-shake-intense'
        default:
            return ''
    }
}
