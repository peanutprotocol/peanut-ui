import { StarLpPage } from '@/components/Marketing/StarLp/StarLpPage'
import { QrBrazilLanding } from '@/components/Marketing/StarLp/pages/QrBrazilLanding'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { starLpMetadata } from '@/components/Marketing/StarLp/starLpMetadata'

// Render per request so a cached page never shows an old rate as today's.
// The /fx/rate fetch keeps its own 300 s Data Cache, so API load is unchanged.
export const dynamic = 'force-dynamic'

export const metadata = starLpMetadata({
    title: 'Pay with Pix in Brazil | Peanut',
    description: 'No CPF needed to pay. Verify once with your passport, add dollars, scan.',
    ogTitle: 'No CPF? No problem at the counter.',
    ogSubtitle: 'Pay shops and people with Pix in Brazil, from your dollars.',
    path: STAR_LP_ROUTES.qrBrazil,
})

export default function Page() {
    return (
        <StarLpPage>
            <QrBrazilLanding />
        </StarLpPage>
    )
}
