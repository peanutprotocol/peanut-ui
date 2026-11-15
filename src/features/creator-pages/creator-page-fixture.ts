import type { CreatorPageProps } from '@/features/tracked-links/contract'

/** Props for the dev preview and the tests: the shape the /go engine passes for an Instagram visit. */
export function creatorPageFixture(username: string, variant: string): CreatorPageProps {
    return {
        creator: { username, linkId: 'invite_' + '0'.repeat(64) },
        variant,
        ctaHref: `/home?app_entry=1&tl=${username}&acq_invite=${username}&tl_s=ig&tl_r=l.instagram.com&tl_v=${variant}&tl_e=n1`,
        visit: {
            username,
            placement: 'ig',
            code: null,
            utm: { source: null, medium: null, campaign: null, content: null },
            referrerHost: 'l.instagram.com',
        },
    }
}
