/**
 * Tones for DevChip. Kept in its own module because the surface-kind taxonomy
 * (journey/surfaceKindMeta.ts) maps onto it and components may not export types.
 */
export type DevChipTone = 'neutral' | 'lavender' | 'yellow' | 'pink' | 'green' | 'ink'

export const DEV_CHIP_TONE_CLASS: Record<DevChipTone, string> = {
    neutral: 'bg-white text-foreground-primary',
    lavender: 'bg-purple-200 text-foreground-primary',
    yellow: 'bg-action-secondary text-foreground-primary',
    pink: 'bg-action-primary text-foreground-primary',
    green: 'bg-green-400 text-foreground-primary',
    ink: 'bg-black text-white',
}
