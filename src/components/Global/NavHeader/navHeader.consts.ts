// board 17802:61534 top-nav circle button: 40px visual, no shadow, pseudo-element
// extends the hit area to 44px (touch-target law — was 28px, the "opened support
// instead of going back" bug).
//
// It pairs with `variant="transparent"`: the nav board draws this control as a
// ring on the page background, which is the states board's ghost icon-only
// button (17308:13973) — no fill and no shadow at rest, the brand pink as the
// hover and pressed fill. White-with-no-shadow was a secondary button robbed of
// its shadow, a state the board does not have. `border` puts back the ring the
// ghost variant removes (`border-solid` is what evicts its `border-none`), and
// the two `!` beat the variant's own background rules.
export const NAV_CIRCLE_BUTTON_CLASSES =
    'relative size-10 w-10 border border-solid p-0 hover:bg-action-primary! active:bg-action-primary! after:absolute after:-inset-0.5'
