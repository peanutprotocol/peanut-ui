// The Notion board is the ONLY place applications are submitted — every other
// link on /careers stays on peanut.me. Use the public *.notion.site URL, not
// the www.notion.so workspace URL, which bounces logged-out visitors to a login.
export const NOTION_JOB_BOARD_URL = 'https://peanutprotocol.notion.site/Career-b351de56d92e405e962f0027b3a60f52'

export interface OpenRole {
    slug: string
    title: string
    location: string
    compensation: string
    summary: string
}

// Mirrors the live rows on the Notion board above. Empty is a valid state —
// Careers.tsx renders an empty-roles message rather than an empty section.
export const OPEN_ROLES: OpenRole[] = [
    {
        slug: 'growth-latam-nomad-community',
        title: 'Growth: Latam & Nomad Community',
        location: 'Remote',
        compensation: '$3–6k/mo + equity',
        summary:
            'Peanut already serves digital nomads, travelers, remote workers, and anyone moving money across borders — Argentina and Brazil most of all. This role grows those communities. Full detail sits on the board.',
    },
]
