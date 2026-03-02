/**
 * Team member data for the /team page and blog author attribution.
 *
 * TODO (team): Fill in real team member data:
 * - name: Full name
 * - role: Job title
 * - bio: 1-2 sentence bio focusing on expertise (builds E-E-A-T for Google)
 * - slug: URL-safe identifier (used for /team/{slug} if individual pages are added later)
 * - image: Path to headshot in /public/team/ (recommended: 400x400px, WebP format)
 * - social: Optional links to LinkedIn, Twitter/X, GitHub
 *
 * Why this matters for SEO:
 * - Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trust) signals
 * - Blog posts linked to real author profiles rank better
 * - Author structured data (schema.org/Person) builds entity recognition
 */

export interface TeamMember {
    slug: string
    name: string
    role: string
    bio: string
    image?: string
    social?: {
        linkedin?: string
        twitter?: string
        github?: string
    }
}

export const TEAM_MEMBERS: TeamMember[] = [
    // TODO (team): Replace with real team data
    {
        slug: 'hugo',
        name: 'Hugo Montenegro',
        role: 'Co-Founder',
        bio: 'Building Peanut to make cross-border payments accessible to everyone.',
    },
    {
        slug: 'konrad',
        name: 'Konrad',
        role: 'Co-Founder',
        bio: 'Focused on growth and making Peanut the easiest way to send money internationally.',
    },
]

/** Find a team member by slug */
export function getTeamMember(slug: string): TeamMember | undefined {
    return TEAM_MEMBERS.find((m) => m.slug === slug)
}
