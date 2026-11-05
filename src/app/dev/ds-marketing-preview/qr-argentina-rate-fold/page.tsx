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
    effectiveAt: '2026-10-21T07:44:59.000Z',
}

/**
 * /qr-payments/argentina's cream rate fold in each tier, with fixed inputs:
 * live (a 4-digit rate, then a 5-digit one that must shrink, never scroll
 * sideways), last-known (30 min to 12 h old: "≈" and the rate rounded) and none
 * (older than 12 h or never read: "Best rate"). The live page picks the tier on
 * the server from the backend's timestamps, so QA shoots here.
 */
export default function QrArgentinaRateFoldPreview() {
    return (
        <AppModalProvider>
            <main className={`${starLpKnerdOutline.variable} ${starLpKnerdFilled.variable} bg-background-page`}>
                <Band ground="cream" id="live">
                    <QrArgentinaRateFold usdArs={{ tier: 'live', quote: FIXTURE }} />
                </Band>
                <Band ground="cream" id="live-5-digit">
                    <QrArgentinaRateFold usdArs={{ tier: 'live', quote: { ...FIXTURE, rate: 16018.8 } }} />
                </Band>
                <Band ground="cream" id="last-known">
                    <QrArgentinaRateFold usdArs={{ tier: 'lastKnown', quote: FIXTURE }} />
                </Band>
                <Band ground="cream" id="none">
                    <QrArgentinaRateFold usdArs={{ tier: 'none', quote: null }} />
                </Band>
            </main>
        </AppModalProvider>
    )
}
