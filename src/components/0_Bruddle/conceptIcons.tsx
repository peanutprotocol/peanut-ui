import Image, { type StaticImageData } from 'next/image'
import { LOGO } from '@/assets/brand'
import STAR_STRAIGHT_ICON from '@/assets/icons/starStraight.svg'
import PIX from '@/assets/payment-apps/pix.svg'
import { type IconName } from '@/components/Global/Icons/Icon'
import { type IconBubbleColor } from './IconBubble'

/** An icon in its coloured bubble. */
type ConceptBubble = { icon: IconName | React.ReactElement; color: IconBubbleColor }
/** A brand mark that is the whole circle: no bubble behind it, so no colour can reach it. */
type ConceptLogo = { logo: StaticImageData }
export type ConceptIcon = ConceptBubble | ConceptLogo

/**
 * One icon and one bubble color per product concept (TASK-23054). A row,
 * drawer, picker or activity item that shows a concept reads its pair here,
 * always through IconBubble: `<IconBubble {...CONCEPT_ICONS.bank} size="s" />`.
 * Change a concept's look in this map, never at a call site.
 *
 * Flags, chain logos and the Mercado Pago mark are not concepts: they name one
 * country, network or brand and keep their own image in the same leading slot.
 * The Pix mark is the one brand mark here (`pix`): Pix is a method of its own
 * in the app (an Add money entry, its setup, a Home step). It is a `logo`
 * entry: the mark as it ships is the whole circle, with no bubble behind it,
 * the way a flag or a chain logo leads a row (Aleks, 2026-11-12, TASK-24841).
 *
 * Blue is the usual method color and gray is inactive. Yellow marks
 * Peanut's own concepts: the Peanut user, friends, the card, rewards. QR pay is pink,
 * the brand fill: it is the one primary action the bottom nav's QR button
 * draws in `action-primary`, the same pink (hugo, 2026-09-25).
 *
 * The bubble names the concept, never its status: a row's status lives in its
 * badge, so an available and a locked QR row draw the same pink bubble.
 */
export const CONCEPT_ICONS = {
    bank: { icon: 'bank', color: 'blue' },
    bankAccount: { icon: 'bank', color: 'green' },
    cash: { icon: 'currency', color: 'blue' },
    balance: { icon: 'dollar', color: 'yellow' },
    crypto: { icon: 'coins', color: 'blue' },
    // the mark as it ships, never recolored or cropped: the whole circle, no bubble
    pix: { logo: PIX },
    sendLink: { icon: 'link', color: 'blue' },
    requestLink: { icon: 'link', color: 'blue' },
    qrPay: { icon: 'qr-code', color: 'brand' },
    addMoney: { icon: 'arrow-down', color: 'blue' },
    // mirrors addMoney: money in is arrow-down, money out is arrow-up
    withdraw: { icon: 'arrow-up', color: 'blue' },
    exchange: { icon: 'exchange', color: 'blue' },
    support: { icon: 'peanut-support', color: 'blue' },
    // the KYC start drawer's hero glyph (InitiateKycModal)
    verification: { icon: 'badge', color: 'blue' },
    otherCountries: { icon: 'globe', color: 'blue' },
    // 5/8 of the bubble: 20px in the s bubble, as the mascot was drawn there
    peanutUser: {
        icon: <Image src={LOGO} alt="" className="h-5/8 w-auto" />,
        color: 'yellow',
    },
    friends: { icon: 'users', color: 'yellow' },
    card: { icon: 'credit-card', color: 'yellow' },
    // the star beside Points on the home top nav: points, perks and rewards
    rewards: {
        icon: <Image src={STAR_STRAIGHT_ICON} alt="" className="h-1/2 w-auto" />,
        color: 'yellow',
    },
    badges: { icon: 'achievements', color: 'yellow' },
} as const satisfies Record<string, ConceptIcon>

export type Concept = keyof typeof CONCEPT_ICONS

/**
 * The concepts drawn as an icon in a coloured bubble: every one but a logo. A
 * modal or drawer hero (ActionModal, AskShell) composes the icon and the colour
 * itself, so it takes one of these.
 */
export type IconConcept = {
    [K in Concept]: (typeof CONCEPT_ICONS)[K] extends ConceptBubble ? K : never
}[Concept]
