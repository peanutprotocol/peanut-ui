import Image from 'next/image'
import { PEANUTMAN } from '@/assets/mascot'
import STAR_STRAIGHT_ICON from '@/assets/icons/starStraight.svg'
import { type IconName } from '@/components/Global/Icons/Icon'
import { type IconBubbleColor } from './IconBubble'

/**
 * One icon and one bubble color per product concept (TASK-23054). A row,
 * drawer, picker or activity item that shows a concept reads its pair here,
 * always through IconBubble: `<IconBubble {...CONCEPT_ICONS.bank} size="s" />`.
 * Change a concept's look in this map, never at a call site.
 *
 * Flags, chain logos and payment-brand marks (Pix, Mercado Pago) are not
 * concepts: they name one country, network or brand and keep their own image
 * in the same leading slot.
 *
 * Blue is the method color (the IconBubble showcase: "blue plain information
 * or a neutral method/action icon", gray is inactive). Yellow marks what is
 * Peanut's own: the Peanut user, friends, the card, rewards. QR pay is pink,
 * the brand fill: it is the one primary action the bottom nav's QR button
 * draws in `action-primary`, the same pink (hugo, 2026-09-25).
 *
 * The bubble names the concept, never its status: a row's status lives in its
 * badge, so an available and a locked QR row draw the same pink bubble.
 */
export const CONCEPT_ICONS = {
    bank: { icon: 'bank', color: 'blue' },
    crypto: { icon: 'coins', color: 'blue' },
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
        icon: <Image src={PEANUTMAN} alt="" className="h-5/8 w-auto" />,
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
} as const satisfies Record<string, { icon: IconName | React.ReactElement; color: IconBubbleColor }>

export type Concept = keyof typeof CONCEPT_ICONS
