import { AppModalProvider } from '@/components/Migration/AppModalProvider'
import { Band } from '@/components/Marketing/StarLp/Band'
import { starLpKnerdFilled, starLpKnerdOutline } from '@/components/Marketing/StarLp/starLpFonts'
import type { StarLpFxRate } from '@/components/Marketing/StarLp/starLp.types'
import { QrArgentinaRateFold } from '@/components/Marketing/StarLp/pages/QrArgentinaRateFold'

/** A fixed quote, so the fold can be checked without the backend. Not a real reading. */
const FIXTURE: StarLpFxRate = {
    from: 'USD',
    to: 'ARS',
    rate: 1601.88,
    source: 'manteca',
    fetchedAt: '2026-10-21T07:45:00.000Z',
}

/**
 * /qr-payments/argentina's cream rate fold with fixed inputs: a 4-digit rate,
 * a 5-digit one (the number must shrink, never scroll sideways) and no rate
 * (the fallback). The live page reads /fx/rate on the server and shows the
 * fallback whenever the quote is older than 30 minutes, so QA shoots here.
 */
export default function QrArgentinaRateFoldPreview() {
    return (
        <AppModalProvider>
            <main className={`${starLpKnerdOutline.variable} ${starLpKnerdFilled.variable} bg-background-page`}>
                <Band ground="cream">
                    <QrArgentinaRateFold usdArs={FIXTURE} />
                </Band>
                <Band ground="cream">
                    <QrArgentinaRateFold usdArs={{ ...FIXTURE, rate: 16018.8 }} />
                </Band>
                <Band ground="cream">
                    <QrArgentinaRateFold usdArs={null} />
                </Band>
            </main>
        </AppModalProvider>
    )
}
