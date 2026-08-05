/**
 * Tones for DevChip. Kept in its own module because the surface-kind taxonomy
 * (journey/surfaceKindMeta.ts) maps onto it and components may not export types.
 */
export type DevChipTone = 'neutral' | 'lavender' | 'yellow' | 'pink' | 'green' | 'ink'

export const DEV_CHIP_TONE_CLASS: Record<DevChipTone, string> = {
    neutral: 'bg-white text-n-1',
    lavender: 'bg-primary-3 text-n-1',
    yellow: 'bg-yellow-1 text-n-1',
    pink: 'bg-primary-1 text-n-1',
    green: 'bg-green-1 text-n-1',
    ink: 'bg-n-1 text-white',
}
