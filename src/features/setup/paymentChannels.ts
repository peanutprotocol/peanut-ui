import type { ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { residenceAvailability } from '@/utils/residence-availability'
import { isBridgeSupportedCountry } from '@/utils/regions.utils'
import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import type { Concept } from '@/components/0_Bruddle/conceptIcons'
export type SetupFundingChannel = 'bank' | 'brlBank' | 'arsBank' | 'crypto' | 'peanut'
export type SetupPaymentChannel = SetupFundingChannel | 'card' | 'pix' | 'arQr'
export type SetupChannel = SetupFundingChannel | SetupPaymentChannel
export const SETUP_CHANNEL_CONCEPTS: Record<SetupChannel, Concept> = {
    bank: 'bank',
    brlBank: 'bank',
    arsBank: 'bank',
    pix: 'qrPay',
    arQr: 'qrPay',
    card: 'card',
    crypto: 'crypto',
    peanut: 'friends',
}
export function setupChannelsForResidence(sets: ResidenceRestrictionSets, residence: string, settled: boolean) {
    const country = residence.trim().toUpperCase()
    const available = settled && country ? residenceAvailability(sets, country).available : []
    // Offer methods that can be unlocked, rather than only rails enrolled by the initial KYC intent.
    const restrictions = deriveResidenceRestrictionsFrom(sets, country)
    // BR/AR residents can complete Bridge verification separately from their initial LATAM verification.
    // The legacy Bridge country helper describes destinations and does not include these residences.
    const bridge =
        settled &&
        !!country &&
        !restrictions.banking &&
        (country === 'BR' || country === 'AR' || isBridgeSupportedCountry(country))
    const local: SetupFundingChannel[] = available.includes('pix')
        ? ['brlBank']
        : available.includes('arQr')
          ? ['arsBank']
          : []
    const bank: SetupFundingChannel[] = [...local, ...(bridge ? ['bank' as const] : [])]
    const card = available.includes('card')
    return {
        funding: [...bank, 'crypto', 'peanut'] as SetupFundingChannel[],
        payment: [
            ...(card ? ['card' as const] : []),
            ...bank,
            ...(available.includes('pix') ? ['pix' as const] : []),
            ...(available.includes('arQr') ? ['arQr' as const] : []),
            'crypto',
            'peanut',
        ] as SetupPaymentChannel[],
    }
}
