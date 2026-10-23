import { StarLpPage } from '@/components/Marketing/StarLp/StarLpPage'
import { UsEuAccountsLanding } from '@/components/Marketing/StarLp/pages/UsEuAccountsLanding'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { starLpMetadata } from '@/components/Marketing/StarLp/starLpMetadata'

// Render per request so a cached page never shows an old rate as today's.
// The /fx/rate fetch keeps its own 300 s Data Cache, so API load is unchanged.
export const dynamic = 'force-dynamic'

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
