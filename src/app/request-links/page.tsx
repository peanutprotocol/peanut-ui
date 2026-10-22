import { StarLpPage } from '@/components/Marketing/StarLp/StarLpPage'
import { RequestLinksLanding } from '@/components/Marketing/StarLp/pages/RequestLinksLanding'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { starLpMetadata } from '@/components/Marketing/StarLp/starLpMetadata'

export const metadata = starLpMetadata({
    title: 'Request links | Peanut',
    description: 'One link. They pay. It lands in your balance.',
    ogTitle: '“How do I pay you?” Send this.',
    ogSubtitle: 'One link. They pay. It lands in your balance.',
    path: STAR_LP_ROUTES.requestLinks,
})

export default function Page() {
    return (
        <StarLpPage>
            <RequestLinksLanding />
        </StarLpPage>
    )
}
