import { APP_ENTRY_QUERY_PARAM } from '@/constants/migration.consts'
import { UTM_MEDIUMS, UTM_SOURCES, withUtm } from '@/utils/utm.utils'
import type { StarLpQrCampaign, StarLpQrSlot, StarLpQrUrlInput } from './starLp.types'

/*
 * Short wire values keep the symbol small enough to scan off a 1x laptop
 * screen: version 5 (37 modules) at level L instead of version 7-8 (45-49) with
 * the long names. utm_medium stays: it is required by the UTM taxonomy and
 * every link gate (ops/strategy/utm-tracking.md).
 */
/**
 * Error correction for on-screen codes. A screen code is never torn or
 * smudged, and L is what keeps the URLs at version 5 (M would need 6).
 */
export const STAR_LP_QR_LEVEL = 'L'

const QR_CAMPAIGN_CODE: Record<StarLpQrCampaign, string> = {
    'qr-argentina': 'qr-ar',
    'qr-brazil': 'qr-br',
}

const QR_SLOT_CODE: Record<StarLpQrSlot, string> = {
    'hero-sticker': 'h',
    'close-sticker': 'c',
    'ways-in': 'w',
    'home-sticker': 'm',
}

/**
 * Where a scan of a star-LP QR lands. Flag on: /home?app_entry=1, the same
 * entry DownloadQR uses (native shells open it; browsers go on to /app, the
 * store redirect, with the utm_* params kept). Flag off: web signup.
 * Tagged `utm_campaign=qr-ar|qr-br`, `utm_content=h|c|w|m` (hero, close,
 * ways-in, home: the homepage's pay-like-a-local stickers).
 */
export function starLpQrUrl({ origin, migrationOn, campaign, slot }: StarLpQrUrlInput): string {
    const utm = {
        source: UTM_SOURCES.STAR_LP,
        medium: UTM_MEDIUMS.CONTENT,
        campaign: QR_CAMPAIGN_CODE[campaign],
        content: QR_SLOT_CODE[slot],
    }
    return migrationOn
        ? withUtm(`${origin}/home`, utm, { [APP_ENTRY_QUERY_PARAM]: '1' })
        : withUtm(`${origin}/setup`, utm)
}
