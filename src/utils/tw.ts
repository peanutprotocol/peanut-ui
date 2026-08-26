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
// text-h1..h10, plus the camelCase pair text-headingLarge/text-headingMedium.
// Tailwind's own names (text-sm, text-6xl…) are re-declared in
// the block but already sit in the stock font-size group, so they stay out.
const DS_TYPE_TOKEN =
    /^(?:heading|body|label|button)(?:-[a-z0-9-]+)?$|^(?:headingLarge|headingMedium|display|0|h(?:10|[1-9]))$/

// `--radius-round` (999px) and `--radius-1` (1px). Stock tailwind-merge only
// knows its own t-shirt radii, so it leaves `rounded-round` unrecognised: a
// caller passing `rounded-sm` to a component whose own class is `rounded-round`
// gets BOTH, and css source order — not the caller — decides the corner. That
// is the same silent-loss family as the type tokens, just in the other
// direction (nothing is deleted, the override is ignored instead). Registering
// them makes the caller win, which is the whole point of merging.
const DS_RADIUS_TOKEN = /^(?:round|1)$/

// The remaining custom-token families from globals.css. tw.test.ts parses
// globals.css and asserts every declared token is covered here, so these lists
// cannot go stale silently (tw.ts itself runs in the browser and cannot read
// the css file, hence the lists live here and the census lives in the test).
//
// `theme` scales feed every class group that consumes them (spacing → p/m/gap/
// inset/…, shadow → shadow, ease → ease, animate → animate), so one entry per
// token is enough. `--transition-duration-*` has no theme scale in
// tailwind-merge, so those go through the duration class group directly.
const DS_DURATION_TOKENS = ['instant', 'fast', 'moderate', 'slow']
const DS_EASE_TOKENS = ['spring', 'sharp']
const DS_ANIMATE_TOKENS = ['pulsate', 'pulse-strong', 'blink', 'accordion-down', 'accordion-up', 'star-pulsate-wiggle']
const DS_SAFE_SPACING_TOKENS = ['safe-top', 'safe-right', 'safe-bottom', 'safe-left']
// the brutalist offset shadows from @layer components / @utility shadow-4
const DS_SHADOW_TOKENS = ['2', '4', 'primary-4', 'primary-6', 'primary-8', 'secondary-4', 'secondary-6', 'secondary-8']

export const twMerge = extendTailwindMerge<
    'ds-text-link' | 'ds-text-link-decoration' | 'ds-border-rounded' | 'ds-bg-peanut-repeat'
>({
    extend: {
        theme: {
            ease: DS_EASE_TOKENS,
            animate: DS_ANIMATE_TOKENS,
            shadow: DS_SHADOW_TOKENS,
            spacing: DS_SAFE_SPACING_TOKENS,
        },
        classGroups: {
            'font-size': [{ text: [(value: string) => DS_TYPE_TOKEN.test(value)] }],
            // `--font-weight-extraBlack` yields `font-extraBlack`, which stock
            // tailwind-merge puts in the font-FAMILY group — so `font-sans`
            // deleted the weight. Register it as a weight so it merges with
            // font-bold and coexists with families.
            'font-weight': [{ font: ['extraBlack'] }],
            rounded: [{ rounded: [(value: string) => DS_RADIUS_TOKEN.test(value)] }],
            duration: [{ duration: DS_DURATION_TOKENS }],
            // component classes whose tailwind-shaped names land in color/bg
            // groups by default, so a colour class deleted them: text-link lost
            // to text-foreground-secondary, bg-peanut-repeat-normal lost to bg-white even
            // though they compose in css. Own group each = no cross-conflicts;
            // the peanut patterns still conflict among themselves (an exact
            // class-name entry beats the colour groups' validators).
            'ds-text-link': ['text-link'],
            'ds-text-link-decoration': ['text-link-decoration'],
            'ds-border-rounded': ['border-rounded'],
            'ds-bg-peanut-repeat': [{ 'bg-peanut-repeat': ['normal', 'large', 'small'] }],
        },
    },
})
