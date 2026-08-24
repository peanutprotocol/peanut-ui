import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The app's `twMerge`. Import this, never `tailwind-merge` directly.
 *
 * Stock tailwind-merge only knows Tailwind's own scales. Our type scale lives
 * in the `@theme` block of globals.css as `--text-heading-*`, `--text-body-*`,
 * `--text-label-*` and `--text-button-*`, so `text-body-m-semibold` looks to it
 * like just another `text-*` class — same conflict group as `text-foreground-*`.
 * Last one wins, so `twMerge('text-body-m-semibold text-foreground-primary')`
 * returned `text-foreground-primary` and the typography silently vanished.
 *
 * That is not theoretical: it is why the activity-row amount rendered at
 * weight 400, and it was eating the ActionModal title and description sizes,
 * the card body, the segmented control and the history header too — 8 call
 * sites. Each one still *reads* correct in the source, which is what makes it
 * nasty; you have to look at computed style to see the class was dropped.
 *
 * Registering the families as font-size puts them in a different group from
 * the colors, so both survive. `tw.test.ts` reads globals.css and asserts every
 * `--text-*` token in it survives a merge, so a new family cannot re-open this.
 */

// text-heading-m, text-body-m-semibold, text-label-l, text-button-s, and the
// bare/legacy entries in the same block: text-heading, text-display, text-0,
// text-h1..h10. Tailwind's own names (text-sm, text-6xl…) are re-declared in
// the block but already sit in the stock font-size group, so they stay out.
const DS_TYPE_TOKEN = /^(?:heading|body|label|button)(?:-[a-z0-9-]+)?$|^(?:display|0|h(?:10|[1-9]))$/

export const twMerge = extendTailwindMerge({
    extend: {
        classGroups: {
            'font-size': [{ text: [(value: string) => DS_TYPE_TOKEN.test(value)] }],
        },
    },
})
