/**
 * Quest constants shared across all quest pages
 */

// DevConnect 2025 event period (Argentina Time: UTC-3)
// Nov 17, 00:00:00 ART = Nov 17, 03:00:00 UTC
// Nov 22, 23:59:59 ART = Nov 23, 02:59:59 UTC
export const EVENT_START_UTC = new Date('2025-11-17T03:00:00Z')
export const EVENT_END_UTC = new Date('2025-11-23T02:59:59Z')

// Prize amounts for top 3 positions
export const PRIZE_TIERS = {
    1: '$500',
    2: '$200',
    3: '$100',
} as const

export function isQuestActive(): boolean {
    const now = new Date()
    return now >= EVENT_START_UTC && now <= EVENT_END_UTC
}

export function hasQuestStarted(): boolean {
    const now = new Date()
    return now >= EVENT_START_UTC
}

export function hasQuestEnded(): boolean {
    const now = new Date()
    return now > EVENT_END_UTC
}

export function getQuestStatus(): 'not_started' | 'active' | 'ended' {
    const now = new Date()
    if (now < EVENT_START_UTC) return 'not_started'
    if (now > EVENT_END_UTC) return 'ended'
    return 'active'
}

export const QUEST_CONFIG = {
    most_invites: {
        id: 'most_invites' as const,
        title: 'Most Invites',
        description: 'Invite the most people to Peanut during DevConnect!',
        explainer:
            'Invite friends to Peanut during Nov 17-22 and climb the leaderboard! Each successful invitation counts towards your score, and you will get a part of their points, forever.',
        iconPath: '/badges/most_invites.svg',
        badgeColor: 'YELLOW',
        backgroundColor: 'purple',
        metricLabel: 'invites',
    },
    bank_drainer: {
        id: 'bank_drainer' as const,
        title: 'Bank Drainer',
        description: 'Most funds deposited from banks into Peanut!',
        explainer:
            'Use Banks to deposit money into Peanut during Nov 17-22! US, EU, MX, BR, and ARS countries count. The more you deposit, the higher you rank.',
        iconPath: '/badges/bank_drainer.svg',
        badgeColor: 'PINK',
        backgroundColor: 'pink',
        metricLabel: 'USD deposited',
    },
    biggest_pot: {
        id: 'biggest_pot' as const,
        title: 'Biggest Pot',
        description: 'Most unique contributors to a pot!',
        explainer:
            'Create the request pot with most unique contributors during Nov 17-22! Each unique user who contributes to your pot counts. Rally your community to win.',
        iconPath: '/badges/biggest_request_pot.svg',
        badgeColor: 'BLUE',
        backgroundColor: 'blue',
        metricLabel: 'unique contributors',
    },
} as const

export type QuestId = keyof typeof QUEST_CONFIG
