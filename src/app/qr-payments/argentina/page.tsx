import { StarLpPage } from '@/components/Marketing/StarLp/StarLpPage'
import { QrArgentinaLanding } from '@/components/Marketing/StarLp/pages/QrArgentinaLanding'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { starLpMetadata } from '@/components/Marketing/StarLp/starLpMetadata'

// Render per request so a cached page never shows an old rate as today's.
// The /fx/rate fetch keeps its own 300 s Data Cache, so API load is unchanged.
export const dynamic = 'force-dynamic'

export const metadata = starLpMetadata({
    title: 'Pay Mercado Pago QRs in Argentina | Peanut',
    description: 'Pay Mercado Pago QRs in Argentina with your passport.',
    ogTitle: 'No DNI? No problem.',
    ogSubtitle: 'Pay Mercado Pago QRs in Argentina with your passport.',
    path: STAR_LP_ROUTES.qrArgentina,
})

export default function Page() {
    return (
        <StarLpPage>
            <QrArgentinaLanding />
        </StarLpPage>
    )
}
