import { StarLpPage } from '@/components/Marketing/StarLp/StarLpPage'
import { QrArgentinaLanding } from '@/components/Marketing/StarLp/pages/QrArgentinaLanding'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { starLpMetadata } from '@/components/Marketing/StarLp/starLpMetadata'

export const metadata = starLpMetadata({
    title: 'Pay Mercado Pago QRs in Argentina | Peanut',
    description: 'Pay Mercado Pago QRs in Argentina with your passport.',
    ogTitle: 'No DNI? No problem at the till.',
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
