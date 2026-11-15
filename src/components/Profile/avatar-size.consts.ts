// A person avatar has two sizes (TASK-24388, approved by Konrad 2026-11-04):
// `s` 32 px wherever a person sits in a list, row or card, and `xl` 96 px
// where the person is the subject of the screen (a profile, the payment
// details header). Five sizes (24/32/48/64/96) had drifted across the app, so
// the same person read at a different size on every screen. Anything that
// shares a person slot (bank flag, wallet, link bubble, merchant logo) takes
// the slot's size, so rows and headers stay aligned. The names match the
// IconBubble sizes of the same px.
//
// Type per box: 32 = Label/M (board 17802:61529, S), 96 = Heading/M (the
// board draws no 96 row).
export type AvatarSize = 's' | 'xl'

export const AVATAR_SIZE_CLASSES: Record<AvatarSize, string> = {
    s: 'h-8 w-8 text-label-m',
    xl: 'h-24 w-24 text-heading-m',
}
