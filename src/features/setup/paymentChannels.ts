import type { ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { residenceAvailability, type AvailabilityRailKey } from '@/utils/residence-availability'
import type { Concept } from '@/components/0_Bruddle/conceptIcons'

export type SetupFundingChannel = AvailabilityRailKey | 'crypto' | 'peanut'
export type SetupPaymentChannel = AvailabilityRailKey | 'card' | 'peanut'
export type SetupChannel = SetupFundingChannel | SetupPaymentChannel

export const SETUP_CHANNEL_CONCEPTS: Record<SetupChannel, Concept> = {
    eurSepa: 'bank',
    gbpFps: 'bank',
    usdAch: 'bank',
    spei: 'bank',
    pix: 'qrPay',
    arQr: 'qrPay',
    card: 'card',
    crypto: 'crypto',
    peanut: 'friends',
}

/** Choices describe what residence verification can unlock, not active accounts. */
export function setupChannelsForResidence(sets: ResidenceRestrictionSets, residence: string, settled: boolean) {
    const country = residence.trim().toUpperCase()
    const available = settled && country ? residenceAvailability(sets, country).available : []
    const rails = available.filter(
        (item): item is AvailabilityRailKey => item !== 'p2p' && item !== 'card' && item !== 'bank'
    )
    // The local-payment introduction replaces the card for AR/BR in this journey.
    const card = available.includes('card') && country !== 'AR' && country !== 'BR'
    return {
        funding: [...rails, 'crypto', 'peanut'] as SetupFundingChannel[],
        payment: [...(card ? ['card' as const] : []), ...rails, 'peanut'] as SetupPaymentChannel[],
    }
}
