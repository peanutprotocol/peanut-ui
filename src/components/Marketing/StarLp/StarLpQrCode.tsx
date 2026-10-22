'use client'

import QRCode from 'react-qr-code'
import { SELF_URL } from '@/constants/general.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useHydrationSnapshot } from '@/utils/native-platform'
import { twMerge } from '@/utils/tw'
import { STAR_LP_QR_LEVEL, starLpQrUrl } from './starLpQr.utils'
import type { StarLpQrCodeProps } from './starLp.types'

/**
 * A real, scannable QR for the QR-payment pages' till stickers. It opens
 * Peanut (signup, or the app store when the PWA sunset is on), tagged with the
 * page and slot. Version 5 at level L (37 modules, see starLpQr.utils); the
 * inner padding is the quiet zone (about 4.6 modules).
 */
export function StarLpQrCode({ campaign, slot, className }: StarLpQrCodeProps) {
    const migrationOn = useMigrationFlag()
    // Keep preview and LAN scans on the server that showed the code.
    const origin = useHydrationSnapshot(
        () => window.location.origin,
        () => SELF_URL
    )
    const url = starLpQrUrl({ origin, migrationOn, campaign, slot })
    return (
        <div className={twMerge('block aspect-square text-foreground-primary', className)} data-qr-url={url}>
            {/* The quiet zone scales with the code, so it is a share of the width, not a spacing step. */}
            <div className="size-full bg-background-default" style={{ padding: '10%' }}>
                <QRCode
                    value={url}
                    level={STAR_LP_QR_LEVEL}
                    fgColor="currentColor"
                    bgColor="transparent"
                    className="block size-full"
                    title="QR code that opens Peanut"
                />
            </div>
        </div>
    )
}
