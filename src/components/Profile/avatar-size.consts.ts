export type AvatarSize = 'xs' | 's' | 'm' | 'l' | 'xl'

// board 17802:61529 sizes XS/S/M/L are 24/32/48/64 — the boxes here already
// matched, under different names, but every initials step was raw stock
// type and none of the five sat on the DS scale. Board type per box:
// 24 and 32 = Label/M, 48 = Body/M-SemiBold, 64 = Heading/S. `xl` (96)
// has no board row and takes the next heading step up.
export const AVATAR_SIZE_CLASSES: Record<AvatarSize, string> = {
    xs: 'h-6 w-6 text-label-m',
    s: 'h-8 w-8 text-label-m',
    m: 'h-12 w-12 text-body-m-semibold',
    l: 'h-16 w-16 text-heading-s',
    xl: 'h-24 w-24 text-heading-m',
}
