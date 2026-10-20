import { StarLpPage } from '@/components/Marketing/StarLp/StarLpPage'
import { PeanutCardLanding } from '@/components/Marketing/StarLp/pages/PeanutCardLanding'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { starLpMetadata } from '@/components/Marketing/StarLp/starLpMetadata'

export const metadata = starLpMetadata({
    title: 'US Dollar Card in pink | Peanut',
    description: 'A US Dollar Card in pink, accepted wherever Visa is accepted. Verification and approval required.',
    ogTitle: 'US Dollar Card in pink',
    ogSubtitle: 'Get your virtual card.',
    path: STAR_LP_ROUTES.peanutCard,
})

export default function Page() {
    return (
        <StarLpPage siteDirectory={false}>
            <PeanutCardLanding />
        </StarLpPage>
    )
}
