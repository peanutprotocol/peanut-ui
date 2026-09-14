export type AvatarSize = 'tiny' | 'extra-small' | 'small' | 'medium' | 'large'

// board 17802:61529 sizes XS/S/M/L are 24/32/48/64 — the boxes here already
// matched, under different names, but every initials step was raw stock
// type and none of the five sat on the DS scale. Board type per box:
// 24 and 32 = Label/M, 48 = Body/M-SemiBold, 64 = Heading/S. `large` (96)
// has no board row and takes the next heading step up.
export const AVATAR_SIZE_CLASSES: Record<AvatarSize, string> = {
    tiny: 'h-6 w-6 text-label-m',
    'extra-small': 'h-8 w-8 text-label-m',
    small: 'h-12 w-12 text-body-m-semibold',
    medium: 'h-16 w-16 text-heading-s',
    large: 'h-24 w-24 text-heading-m',
}
