import { StarLpPage } from '@/components/Marketing/StarLp/StarLpPage'
import { PeanutCardLanding } from '@/components/Marketing/StarLp/pages/PeanutCardLanding'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { starLpMetadata } from '@/components/Marketing/StarLp/starLpMetadata'

export const metadata = starLpMetadata({
    title: 'Peanut Card in US dollars | Peanut',
    description:
        'A virtual card with a balance in US dollars, accepted wherever Visa is accepted. Verification and approval required.',
    ogTitle: 'Peanut Card in dollars',
    ogSubtitle: 'Tap in pink.',
    path: STAR_LP_ROUTES.peanutCard,
})

export default function Page() {
    return (
        <StarLpPage siteDirectory={false} localeSwitcher={false}>
            <PeanutCardLanding />
        </StarLpPage>
    )
}
