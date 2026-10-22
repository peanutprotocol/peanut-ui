/**
 * The page's one purchase: the asado for six, paid by QR at a parrilla. The
 * pay screen, the shop's phone and the group chat's request all use it.
 * A merchant price in pesos, not FX.
 */
export const QR_AR_PRICE_ARS = 120_000
export const QR_AR_MERCHANT = 'Parrilla La Esquina'
/** Six at the table, so each friend owes a sixth of the bill. */
export const QR_AR_DINERS = 6

/** The sky fold with both phones; the Review's Pay button scrolls here. */
export const QR_AR_THEIR_SCREEN_ID = 'their-screen'

/** Fired by the Review's Pay button; the two-phone fold replays its beats. */
export const QR_AR_PAID_EVENT = 'star-lp:qr-ar-paid'

/** The Review's Pay shows the app's processing beat this long before the shop's screen plays. */
export const QR_AR_PAYING_MS = 450

/**
 * Page-scoped motion (rendered once by QrArgentinaMotionStyle). Transform and
 * opacity only. Everything is at rest without it: the one-shots start from a
 * visible pose, and the scan lines are hidden until they play.
 */
export const QR_AR_MOTION_CSS = `
.qr-ar-scan{opacity:0}
.qr-ar-press{transition:transform 150ms ease-out,box-shadow 150ms ease-out}
.qr-ar-chat-link>div{transition:transform 150ms ease-out}
.qr-ar-chat-link:active>div{transform:scale(.97)}
.star-lp-beat:has(>.qr-ar-chat-link:focus-visible){opacity:1;transform:none;pointer-events:auto}
.star-lp-beat:has(>.qr-ar-chat-link:focus-visible) .qr-ar-chat-link{pointer-events:auto}
.qr-ar-press:active{transform:translate(4px,4px);box-shadow:none}
.qr-ar-push{transition:opacity 450ms ease-out,transform 450ms cubic-bezier(.34,1.56,.64,1)}
.qr-ar-push[data-shown='false']{opacity:0;transform:translateY(-120%) scale(.98)}
.qr-ar-paid>*{transition:opacity 300ms ease-out,transform 350ms var(--ease-spring)}
.qr-ar-paid[data-shown='false']>*{opacity:0}
.qr-ar-paid[data-shown='false']>.qr-ar-paid-text{transform:translateY(6px)}
.qr-ar-paid[data-shown='true']>.qr-ar-paid-text{transition-delay:120ms}
@media (prefers-reduced-motion:no-preference){
.qr-ar-settle{animation:qr-ar-settle 600ms var(--ease-spring) 300ms both}
.qr-ar-hero-scan{animation:qr-ar-scan-twice 2.8s ease-in-out 900ms both}
.qr-ar-buzz[data-buzz='true']{animation:qr-ar-buzz 95ms linear 150ms 3}
.qr-ar-paid[data-shown='true']>.qr-ar-tick{animation:qr-ar-tick 350ms ease-out}
}
@media (prefers-reduced-motion:reduce){
.qr-ar-push[data-shown='false'],.qr-ar-paid[data-shown='false']>*{opacity:1;transform:none}
.qr-ar-push,.qr-ar-paid>*{transition:none}
}
@keyframes qr-ar-settle{from{transform:rotate(-8deg) translateY(-8px)}}
@keyframes qr-ar-scan-twice{
0%{transform:translateY(0);opacity:0}
6%{opacity:1}
50%{transform:translateY(calc(100% - 2px))}
92%{opacity:1}
100%{transform:translateY(0);opacity:0}
}
@keyframes qr-ar-buzz{25%{transform:rotate(1.5deg)}75%{transform:rotate(-1.5deg)}}
@keyframes qr-ar-tick{0%{transform:scale(.4)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
`
