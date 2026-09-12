export interface DirectionOption {
    key: 'A' | 'B' | 'C'
    title: string
    summary: string
    /** what it costs us, stated plainly */
    cost: string
    recommended?: boolean
}

export interface DirectionQuestion {
    id: string
    question: string
    /** why the answer matters, in one sentence */
    stake: string
    options: DirectionOption[]
    /** what the built prototype currently does */
    built: string
}

/**
 * The product decisions the prototype does not settle.
 *
 * Each one is a real fork with a real cost, not a menu of equivalents. The
 * recommendation is the shipped answer unless somebody changes it; the other
 * options are here so changing it is one conversation rather than a rebuild.
 */
export const DIRECTION_QUESTIONS: DirectionQuestion[] = [
    {
        id: 'entry',
        question: 'Where does a user meet this?',
        stake: 'It decides how many people ever hold an account, and what they think it is for.',
        built: 'Direction A, behind the `deposit-accounts` flag — the flow lives at its own route, and the Add drawer\u2019s bank row points at it only while the flag is on. Off, that row is the one-off transfer flow it always was.',
        options: [
            {
                key: 'A',
                title: 'A row in Add money',
                summary: 'A fifth method beside bank, card and crypto: "Get paid by someone else".',
                cost: 'Only found by people already trying to move money in. Slowest to grow, cheapest to ship, hardest to misread.',
                recommended: true,
            },
            {
                key: 'B',
                title: 'A step in the activation checklist',
                summary: 'A home card next to the other activation steps: "Open your EUR account".',
                cost: 'Home real estate, and it asks for KYC from people who have not yet decided they want anything.',
            },
            {
                key: 'C',
                title: 'A question during onboarding',
                summary: 'We detect the region at signup and offer the account before the first deposit.',
                cost: 'Most accounts held, and the KYC ask lands at the moment with the least trust built. Reverses the drop-off we already fight.',
            },
        ],
    },
    {
        id: 'provision',
        question: 'When does the account get created at the provider?',
        stake: 'Provider objects are not free, and an account nobody uses still carries our name and their compliance.',
        built: 'Direction A — the claim screen is the create call, and it is the only place one is made.',
        options: [
            {
                key: 'A',
                title: 'When the user claims it',
                summary: 'The claim screen states what arrives and what the limits are, then creates the account.',
                cost: 'One extra screen before the details. Every account belongs to somebody who asked for it.',
                recommended: true,
            },
            {
                key: 'B',
                title: 'At verification, for every region at once',
                summary: 'A verified user silently has every corridor; the UI only ever displays.',
                cost: 'No claim step to design, and a pile of provider accounts for people who never wanted one.',
            },
            {
                key: 'C',
                title: 'When somebody asks to pay them',
                summary:
                    'The user says "a client wants to pay me", picks a currency, and the account follows the need.',
                cost: 'The most honest trigger and the hardest to surface — we do not know about the payer until the user tells us.',
            },
        ],
    },
    {
        id: 'dormancy',
        question: 'What happens when a user is gone for a month?',
        stake: 'The details are already in somebody else money transfer form; what we do next is felt by a payer, not just a user.',
        built: 'Direction A — details never expire on our side, and a returned payment is shown with its reason.',
        options: [
            {
                key: 'A',
                title: 'Nothing expires',
                summary:
                    'The details keep working. A payment that bounces at the provider is shown with the reason and a way to send the details again.',
                cost: 'Needs the refund path to be real: without it, a returned payment is silent and the user learns from the payer.',
                recommended: true,
            },
            {
                key: 'B',
                title: 'Ask on the way back in',
                summary:
                    'Details keep working, and the next time the user opens the app we ask them to confirm the account is still theirs.',
                cost: 'One interruption for returning users. Catches a changed name or a closed rail before a payer does.',
            },
            {
                key: 'C',
                title: 'Hold deposits until re-verified',
                summary: 'After a dormancy window, arriving money waits until the user verifies again.',
                cost: 'Safest for us, worst for them: their salary sits still while they are asked for a document.',
            },
        ],
    },
    {
        id: 'naming',
        question: 'What do we call it?',
        stake: 'The name sets the expectation of what the thing is, and we cannot change it after payroll forms carry it.',
        built: 'Direction B — "Get paid" as the flow title, "deposit accounts" in code.',
        options: [
            {
                key: 'A',
                title: 'Virtual account',
                summary: 'The provider term, and what the industry calls it.',
                cost: 'Means nothing to a person who just wants their salary in the app. "Virtual" reads as "not real money".',
            },
            {
                key: 'B',
                title: 'Get paid',
                summary: 'Named after the job, not the mechanism.',
                cost: 'Says nothing about what it is until they open it. Reads right to the person who needs it.',
                recommended: true,
            },
            {
                key: 'C',
                title: 'Your EUR account',
                summary: 'Named as an account they hold.',
                cost: 'True on EUR, USD and MXN today and false on GBP, where the account is in Bridge name. One string cannot be both.',
            },
        ],
    },
]
