import { StarLpPage } from '@/components/Marketing/StarLp/StarLpPage'
import { UsEuAccountsLanding } from '@/components/Marketing/StarLp/pages/UsEuAccountsLanding'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { starLpMetadata } from '@/components/Marketing/StarLp/starLpMetadata'

export const metadata = starLpMetadata({
    title: 'Get paid from the US and Europe | Peanut',
    description: 'US account details and a euro IBAN, so clients in the US and Europe can pay you.',
    ogTitle: 'Get paid from the US and Europe',
    ogSubtitle: 'US account details and a euro IBAN.',
    path: STAR_LP_ROUTES.usEuAccounts,
})

export default function Page() {
    return (
        <StarLpPage>
            <UsEuAccountsLanding />
        </StarLpPage>
    )
}
