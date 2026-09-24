import Image from 'next/image'
import { PEANUTMAN } from '@/assets/mascot'
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
 * Peanut's own: the Peanut user, friends, the card, rewards.
 */
export const CONCEPT_ICONS = {
    bank: { icon: 'bank', color: 'blue' },
    crypto: { icon: 'coins', color: 'blue' },
    sendLink: { icon: 'link', color: 'blue' },
    requestLink: { icon: 'link', color: 'blue' },
    qrPay: { icon: 'qr-code', color: 'blue' },
    addMoney: { icon: 'arrow-down', color: 'blue' },
    withdraw: { icon: 'user', color: 'blue' },
    exchange: { icon: 'exchange', color: 'blue' },
    support: { icon: 'peanut-support', color: 'blue' },
    verification: { icon: 'user-id', color: 'blue' },
    otherCountries: { icon: 'globe', color: 'blue' },
    // 5/8 of the bubble: 20px in the s bubble, as the mascot was drawn there
    peanutUser: {
        icon: <Image src={PEANUTMAN} alt="" className="h-5/8 w-auto" />,
        color: 'yellow',
    },
    friends: { icon: 'users', color: 'yellow' },
    card: { icon: 'credit-card', color: 'yellow' },
    rewards: { icon: 'trophy', color: 'yellow' },
    badges: { icon: 'achievements', color: 'yellow' },
} as const satisfies Record<string, { icon: IconName | React.ReactElement; color: IconBubbleColor }>

export type Concept = keyof typeof CONCEPT_ICONS
