import { StarLpPage } from '@/components/Marketing/StarLp/StarLpPage'
import { SelfCustodyLanding } from '@/components/Marketing/StarLp/pages/SelfCustodyLanding'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { starLpMetadata } from '@/components/Marketing/StarLp/starLpMetadata'

export const metadata = starLpMetadata({
    title: 'Your money, your key | Peanut',
    description: 'Your balance sits in your own account, and every send needs your passkey.',
    ogTitle: 'Your money. Only you can send it.',
    ogSubtitle: 'Your balance sits in your own account. Every send needs your passkey.',
    path: STAR_LP_ROUTES.selfCustody,
})

export default function Page() {
    return (
        <StarLpPage>
            <SelfCustodyLanding />
        </StarLpPage>
    )
}
