import { STAR_LP_PERSONA, STAR_LP_REQUEST_LINK_TEXT } from '@/components/Marketing/StarLp/starLpPersonas.consts'

/** The one illustrative request the page follows from first reply to balance. */
export const REQUEST_LINKS_STORY = {
    payer: STAR_LP_PERSONA.payer.short,
    requester: STAR_LP_PERSONA.main.name,
    initials: STAR_LP_PERSONA.main.initials,
    /** The handle the app shows on the request page and in Activity captures. */
    username: STAR_LP_PERSONA.main.username,
    payerUsername: STAR_LP_PERSONA.payer.username,
    amount: '$400',
    note: 'Logo, final files',
    /** Cut after the username: the real link ends in the token name, which marketing copy never shows. */
    url: STAR_LP_REQUEST_LINK_TEXT,
} as const

/** The in-page anchor for the "This is what your client sees" fold. */
export const REQUEST_LINKS_CLIENT_SEES_ID = 'client-sees'

/** Fired after a link card scrolls the visitor to the client fold, so its phone pops again. */
export const REQUEST_LINKS_CLIENT_SEES_EVENT = 'request-links:client-sees'

/** Timeline beat spacing, ms. The rail segments draw on the same beat. */
export const REQUEST_LINKS_STEP_MS = 450

/**
 * The page's own keyframes and hover states (the QrArgentinaMotionStyle pattern).
 * Server-rendered, so the hero beat runs before hydration. Transform and opacity
 * only; every motion sits under no-preference, so reduced motion paints at rest.
 */
export const REQUEST_LINKS_MOTION_CSS = `
.rl-link{transition:transform 300ms var(--ease-spring)}
.rl-link .rl-lift{transition:box-shadow 150ms ease-out}
.rl-link:active{transform:translate(2px,2px)}
.rl-link[data-sink='md']:active{transform:translate(4px,4px)}
.rl-link:active .rl-lift{box-shadow:none}
.rl-typing{display:none}
@media (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference){
.rl-link:hover{transform:translateY(-4px) rotate(.75deg)}
.rl-link:hover .rl-lift.shadow-2{box-shadow:.25rem .25rem 0 #000}
.rl-link:hover .rl-lift.shadow-4{box-shadow:6px 6px 0 #000}
.rl-link:hover:active{transform:translate(2px,2px)}
.rl-link[data-sink='md']:hover:active{transform:translate(4px,4px)}
.rl-link:hover:active .rl-lift{box-shadow:none}
}
@media (prefers-reduced-motion:no-preference){
.rl-typing{display:flex;animation:rl-typing-out 900ms linear both}
.rl-typing>span{animation:rl-typing-dot 450ms ease-in-out 300ms both}
.rl-typing>span:nth-child(2){animation-delay:450ms}
.rl-typing>span:nth-child(3){animation-delay:600ms}
.rl-card-land{animation:rl-card-land 520ms cubic-bezier(.2,1.25,.3,1) 900ms both}
.rl-old[data-play='true'] .rl-stamp{animation:rl-stamp 180ms ease-out both}
.rl-old[data-play='true'] .rl-paid>span:first-child{animation:rl-check 420ms var(--ease-spring) 1.5s both}
.rl-old[data-play='true'] .rl-hop{animation:rl-hop 600ms var(--ease-spring) 1.7s both}
.rl-feed[data-armed='true'] .rl-paper{transform:translateY(-100%)}
.rl-feed[data-play='true'] .rl-paper{animation:rl-feed 900ms cubic-bezier(.3,0,.2,1) both}
}
@keyframes rl-typing-out{0%,33%{opacity:0}34%,95%{opacity:1}100%{opacity:0}}
@keyframes rl-typing-dot{from{opacity:.3}to{opacity:1}}
@keyframes rl-card-land{from{opacity:0;transform:translateY(-16px) scale(.8) rotate(-6deg)}to{opacity:1;transform:none}}
@keyframes rl-stamp{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
@keyframes rl-check{0%{transform:scale(.5)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes rl-hop{0%,100%{transform:translateY(0) rotate(0)}40%{transform:translateY(-10px) rotate(-8deg)}70%{transform:translateY(0) rotate(3deg)}}
@keyframes rl-feed{0%{transform:translateY(-100%)}38%{transform:translateY(-62%)}42%{transform:translateY(-62%)}68%{transform:translateY(-30%)}72%{transform:translateY(-30%)}100%{transform:translateY(0)}}
`
