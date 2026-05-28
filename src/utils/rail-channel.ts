/**
 * Rail channel classifier — the FE's user-facing categorization of a rail's
 * method into a channel (bank / card / qr-only). Replaces the historical
 * per-consumer guessing ("Bridge ≡ bank, Manteca ≡ QR…") which broke as soon as
 * Manteca's PIX_BR became a bank rail too.
 *
 * Single source of truth for the FE. Eventually promotable to a `channel` field
 * on `RailCapability` from the backend resolver — at which point this file
 * becomes a one-line `rail.channel` accessor. Until then, the FE owns the
 * categorization.
 *
 * Channels:
 *   - `bank`     — user moves money via a bank account (ACH, SEPA, SPEI, PIX,
 *                  AR bank-transfer, faster-payments). Both deposit + withdraw
 *                  + (for PIX) pay routes through bank rails.
 *   - `card`     — user pays / spends via a Peanut card (Rain's product).
 *   - `qr-only`  — user pays via QR scan with no underlying bank account
 *                  involvement (MercadoPago wallet QR in AR).
 *
 * Adding a new rail method: add it to ONE set below.
 */

import type { RailCapability } from '@/types/capabilities'

export type RailChannel = 'bank' | 'card' | 'qr-only'

/** Bank-shaped rails (deposit + withdraw + sometimes pay). */
const BANK_METHODS: ReadonlySet<string> = new Set([
    'ACH_US',
    'SEPA_EU',
    'FASTER_PAYMENTS_GB',
    'SPEI_MX',
    'BANK_TRANSFER_AR',
    'PIX_BR',
])

/** QR-only pay rails (no first-party bank account; MercadoPago wallet etc). */
const QR_ONLY_METHODS: ReadonlySet<string> = new Set(['MERCADOPAGO_QR_AR'])

/** Card rails — Rain's card product. */
const CARD_METHODS: ReadonlySet<string> = new Set(['CARD'])

/**
 * Categorize a rail by its user-facing channel. Returns null if the rail's
 * method is not in any category (defensive — should never happen for a known
 * provider's catalog method).
 */
export function railChannel(rail: { method: string }): RailChannel | null {
    if (BANK_METHODS.has(rail.method)) return 'bank'
    if (QR_ONLY_METHODS.has(rail.method)) return 'qr-only'
    if (CARD_METHODS.has(rail.method)) return 'card'
    return null
}

/** Convenience: filter a list of rails to a given channel. */
export function railsOfChannel(rails: RailCapability[], channel: RailChannel): RailCapability[] {
    return rails.filter((rail) => railChannel(rail) === channel)
}
