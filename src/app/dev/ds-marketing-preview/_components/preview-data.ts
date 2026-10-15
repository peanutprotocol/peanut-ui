// Fixture copy for the preview pages. Dev-tool data, not content: the real
// pages read their copy from the i18n catalogs and the content system. The
// answers describe the rule each demo shows, so the fixture cannot be mistaken
// for a product claim.

export const DEMO_FAQ_ITEMS = [
    {
        id: 'ground',
        question: 'Why is this fold cream?',
        answer: 'The FAQ fold sits on the page ground (background-page), never on a coloured band — one fold, one ground, every page.',
    },
    {
        id: 'heading-pair',
        question: 'Where does the heading size come from?',
        answer: 'The ruled pair: headingSmall (42) at 390, headingMedium (80) at 1440. Toggle the viewport above to see both.',
    },
    {
        id: 'copy',
        question: 'What goes in the heading?',
        answer: 'The copy is "FAQ." everywhere — /shhhhh included. No per-page variants.',
    },
]

export interface DemoTable {
    headers: string[]
    rows: string[][]
}

export const DEMO_TABLE: DemoTable = {
    headers: ['Element', 'Token', 'Rule'],
    rows: [
        ['Header row', 'background-page', 'cream, never a brand tint'],
        ['Body rows', 'background-default', 'white, no zebra tints'],
        ['Rules', 'border-default', 'full-strength, no /10 fades'],
    ],
}
