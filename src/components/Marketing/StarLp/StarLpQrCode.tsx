'use client'

import QRCode from 'react-qr-code'
import { SELF_URL } from '@/constants/general.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useHydrationSnapshot } from '@/utils/native-platform'
import { twMerge } from '@/utils/tw'
import { STAR_LP_QR_LEVEL, starLpQrUrl } from './starLpQr.utils'
import type { StarLpQrCodeProps } from './starLp.types'
import { useMarketingQrUrl } from '@/features/marketing-qr/useMarketingQrUrl'

/**
 * A real, scannable QR for the QR-payment pages' till stickers. It opens
 * Peanut (signup, or the app store when the PWA sunset is on), tagged with the
 * page and slot. Legacy URLs fit version 5 at level L (see starLpQr.utils).
 * Registered marketing URLs use level M; the inner padding is the quiet zone.
 */
export function StarLpQrCode({ campaign, slot, className, qrContext }: StarLpQrCodeProps) {
    const migrationOn = useMigrationFlag()
    // Keep preview and LAN scans on the server that showed the code.
    const origin = useHydrationSnapshot(
        () => window.location.origin,
        () => SELF_URL
    )
    const marketingUrl = useMarketingQrUrl({
        origin,
        context: qrContext ?? {
            page: campaign === 'qr-argentina' ? 'qr-argentina' : 'qr-brazil',
            placement: slot,
            locale: 'en',
        },
        enabled: migrationOn,
    })
    const url = marketingUrl ?? starLpQrUrl({ origin, migrationOn, campaign, slot })
    return (
        <div className={twMerge('block aspect-square text-foreground-primary', className)} data-qr-url={url}>
            {/* The quiet zone scales with the code, so it is a share of the width, not a spacing step. */}
            <div className="size-full bg-background-default" style={{ padding: '10%' }}>
                <QRCode
                    value={url}
                    level={marketingUrl ? 'M' : STAR_LP_QR_LEVEL}
                    fgColor="currentColor"
                    bgColor="transparent"
                    className="block size-full"
                    title="QR code that opens Peanut"
                />
            </div>
        </div>
    )
}
