// board 17802:61534 top-nav circle button: 40px visual, no shadow, pseudo-element
// extends the hit area to 44px (touch-target law — was 28px, the "opened support
// instead of going back" bug).
//
// It pairs with `variant="transparent"`: the nav board draws this control as a
// ring on the page background, which is the states board's ghost icon-only
// button (17308:13973) — no fill and no shadow at rest, a colour fill on hover
// and press. White-with-no-shadow was a secondary button robbed of its shadow,
// a state the board does not have.
//
// hover and press are the SAME fill, action-primary pink — the board draws ONE
// colour for both states (kush ruling 2026-09-21, reverting a short-lived
// action-ghost-hover press that read as purple). On a desktop pointer that
// means no visible hover-to-press change; the board says so, leave it.
//
// `border-solid` is what evicts the ghost variant's `border-none` and puts the
// ring back; the `!`s beat its own background rules (twMerge drops the rest).
// The icon takes the over-colour foreground on the fill — the variant paints
// it action-ghost-hover, which is 2.5:1 on the pink.
export const NAV_CIRCLE_BUTTON_CLASSES =
    'relative size-10 w-10 border border-solid p-0 hover:bg-action-primary! hover:text-foreground-over-color-primary hover:fill-foreground-over-color-primary active:bg-action-primary! active:text-foreground-over-color-primary active:fill-foreground-over-color-primary after:absolute after:-inset-0.5'
