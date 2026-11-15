import { readSignupAttribution } from '@/utils/signup-attribution'
import type { CreatorPageProps } from '../contract'
import { goVisitPosthogProperties } from '../visit-properties'

jest.mock('@/utils/signup-attribution', () => ({ readSignupAttribution: jest.fn() }))

// The fixture from the Contract in mono inbox/go-links/coordination.md.
const props: CreatorPageProps = {
    creator: { username: 'juanacervio', linkId: 'invite_' + '0'.repeat(64) },
    variant: 'a1',
    ctaHref: '/home?app_entry=1&tl=juanacervio&acq_invite=juanacervio&tl_s=ig&tl_r=l.instagram.com&tl_v=a1&tl_e=n1',
    visit: {
        username: 'juanacervio',
        placement: 'ig',
        code: null,
        utm: { source: null, medium: null, campaign: 'spring', content: null },
        referrerHost: 'l.instagram.com',
    },
}
const journeyId = '0b6f1c2e-6a8d-4c1e-9f3a-2d4b5c6d7e8f'

it('returns exactly the visit event keys of the Contract, with the journey of this browser', () => {
    jest.mocked(readSignupAttribution).mockReturnValue({ journeyId } as ReturnType<typeof readSignupAttribution>)
    expect(goVisitPosthogProperties(props)).toEqual({
        link_id: props.creator.linkId,
        signup_journey_id: journeyId,
        opened_in: 'web',
        placement: 'ig',
        code: null,
        utm_source: null,
        utm_medium: null,
        utm_campaign: 'spring',
        utm_content: null,
        referrer_host: 'l.instagram.com',
        page_variant: 'a1',
        page_experiment: 'n1',
    })
})

it('keeps the keys when no journey exists, so events from one page stay one shape', () => {
    jest.mocked(readSignupAttribution).mockReturnValue(null)
    const properties = goVisitPosthogProperties({ ...props, visit: { ...props.visit, placement: null, code: 7 } })
    expect(properties).toMatchObject({ signup_journey_id: null, placement: null, code: 7 })
})
