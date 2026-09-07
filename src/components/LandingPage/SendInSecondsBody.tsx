'use client'

import Image from 'next/image'
import payZeroFees from '@/assets/illustrations/pay-zero-fees.svg'
import mobileSendInSeconds from '@/assets/illustrations/mobile-send-in-seconds.svg'
import dynamic from 'next/dynamic'
import { SendInSecondsCTA } from './SendInSecondsCTA'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import type { LandingStrings } from './landingStrings'

// Split out: it drags AppQrCode -> QRCodeWrapper -> react-qr-code and the
// scanner capture behind it, and it cannot render before mount (the flag is
// false until then), so there is no SSR or hydration cost to deferring it.
const GetTheAppFold = dynamic(() => import('./GetTheAppFold').then((m) => m.GetTheAppFold), { ssr: false })

/**
 * Fold 10's body, which the migration flag swaps whole: today's "send in
 * seconds" headline art and SEND NOW button, or the get-the-app lockup. The
 * fold's chrome (background, clouds, stars) is unchanged and stays on the
 * server; only this inner block reads the flag, which is false until mount, so
 * the flag-off render is byte-identical to today's.
 */
export function SendInSecondsBody({
    strings,
    tagline,
    subtext,
}: {
    strings: LandingStrings
    tagline: React.ReactNode
    subtext?: string
}) {
    const migrationOn = useMigrationFlag()

    if (migrationOn) return <GetTheAppFold strings={strings.migration} tagline={tagline} subtext={subtext} />

    return (
        <>
            <div className="mb-6 md:mb-10">
                {/* Mobile version */}
                <Image
                    src={mobileSendInSeconds}
                    alt="Send in Seconds. Pay Zero Fees. Start Right Now"
                    width={800}
                    height={200}
                    className="mx-auto block h-auto w-[90%] md:hidden"
                />
                {/* Desktop version */}
                <Image
                    src={payZeroFees}
                    alt="Send in Seconds. Pay Zero Fees. Start Right Now"
                    width={800}
                    height={200}
                    className="mx-auto hidden h-auto w-full max-w-lg md:block md:max-w-4xl"
                />
            </div>

            <p
                className="mb-6 hidden font-roboto text-base leading-tight font-medium md:mb-8 md:block md:text-4xl"
                style={{ fontWeight: 500, letterSpacing: '-0.5px' }}
            >
                {tagline}
            </p>

            <div id="sticky-button-target">
                <SendInSecondsCTA strings={strings} />
            </div>
        </>
    )
}
