/**
 * 04's hero in art-box design px (390 x 440), from the mock's LAYOUT (scaffold screens/04-invite/screen.js).
 * Cards: [left, top, rotate]. Mascots: [left, top, width] of the Lottie box. Sparkle: [left, top, width].
 * Corner stars (std only): [left, top, width, kind].
 */
export const INVITE_LAYOUT = {
    std: {
        friend: [24, 252, -6],
        me: [58, 340, 4],
        wave: [154, 179, 262],
        cheer: [169, 182, 243],
        spark: [184, 306, 30],
        deco: [
            [30, 226, 18, 'star'],
            [182, 228, 22, 'sparkle'],
        ],
    },
    sm: {
        friend: [26, 262, -6],
        me: [54, 336, 4],
        wave: [164, 191, 249],
        cheer: [183, 206, 216],
        spark: [180, 310, 28],
        deco: [],
    },
} as const satisfies Record<
    'std' | 'sm',
    {
        friend: readonly [number, number, number]
        me: readonly [number, number, number]
        wave: readonly [number, number, number]
        cheer: readonly [number, number, number]
        spark: readonly [number, number, number]
        deco: ReadonlyArray<readonly [number, number, number, 'star' | 'sparkle']>
    }
>

/** The sample friend on the default card: art, the same handle in every language (mock stills show it in en and es-AR). */
export const SAMPLE_FRIEND_HANDLE = 'fulano'
