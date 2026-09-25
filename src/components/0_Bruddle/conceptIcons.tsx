import Image from 'next/image'
import { PEANUTMAN } from '@/assets/mascot'
import STAR_STRAIGHT_ICON from '@/assets/icons/starStraight.svg'
import { type IconName } from '@/components/Global/Icons/Icon'
import { type StatusType } from '@/components/Global/Badges/Badge'
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
 * Blue = a method, an identity object or plain information; pink = Peanut's
 * own (the Peanut user, friends, the card, rewards, badges). A concept's color
 * never changes with status: where a row shows state, STATE_BUBBLE_COLORS
 * below swaps the color and the concept keeps its icon (TASK-22761).
 */
export const CONCEPT_ICONS = {
    bank: { icon: 'bank', color: 'blue' },
    crypto: { icon: 'coins', color: 'blue' },
    sendLink: { icon: 'link', color: 'blue' },
    requestLink: { icon: 'link', color: 'blue' },
    qrPay: { icon: 'qr-code', color: 'blue' },
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
        color: 'brand',
    },
    friends: { icon: 'users', color: 'brand' },
    card: { icon: 'credit-card', color: 'brand' },
    // the points star, drawn like the mascot above
    rewards: {
        icon: <Image src={STAR_STRAIGHT_ICON} alt="" className="h-5/8 w-auto" />,
        color: 'brand',
    },
    badges: { icon: 'achievements', color: 'brand' },
} as const satisfies Record<string, { icon: IconName | React.ReactElement; color: IconBubbleColor }>

export type Concept = keyof typeof CONCEPT_ICONS

/**
 * In a list that mixes states (activity rows, the receipt head, Unlock
 * payments, the identity verification row) the icon is the concept and the
 * color is the state. A status missing here (completed, active, closed)
 * keeps the concept's own color.
 */
export const STATE_BUBBLE_COLORS: Partial<Record<StatusType, IconBubbleColor>> = {
    pending: 'yellow',
    processing: 'yellow',
    failed: 'red',
    cancelled: 'gray',
    refunded: 'gray',
}

/** The concept's bubble, colored by the row's state. */
export const conceptBubbleFor = (concept: Concept, status?: StatusType) => ({
    icon: CONCEPT_ICONS[concept].icon,
    color: (status && STATE_BUBBLE_COLORS[status]) || CONCEPT_ICONS[concept].color,
})
