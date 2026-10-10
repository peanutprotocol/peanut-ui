import type { ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import type { Concept } from '@/components/0_Bruddle/conceptIcons'
export type SetupFundingChannel = 'bank' | 'brlBank' | 'arsBank' | 'crypto' | 'peanut'
export type SetupPaymentChannel = Exclude<SetupFundingChannel, 'brlBank' | 'arsBank'> | 'card' | 'qr'
export type SetupChannel = SetupFundingChannel | SetupPaymentChannel
export const SETUP_CHANNEL_CONCEPTS: Record<SetupChannel, Concept> = {
    bank: 'bank',
    brlBank: 'bank',
    arsBank: 'bank',
    qr: 'qrPay',
    card: 'card',
    crypto: 'crypto',
    peanut: 'friends',
}
export function setupChannelsForResidence(
    sets: ResidenceRestrictionSets,
    residence: string,
    settled: boolean
): { funding: SetupFundingChannel[]; payment: SetupPaymentChannel[] } {
    const country = residence.trim().toUpperCase()
    const restrictions = deriveResidenceRestrictionsFrom(sets, country)
    const known = settled && !!country
    // Bridge eligibility follows residence restrictions, not the destination-country list.
    const bridge = known && !restrictions.banking
    const local: SetupFundingChannel[] =
        known && !restrictions.banking && country === 'BR'
            ? ['brlBank']
            : known && !restrictions.banking && country === 'AR'
              ? ['arsBank']
              : []
    const bank: SetupFundingChannel[] = [...local, ...(bridge ? (['bank'] as const) : [])]
    const card = known && !restrictions.card
    // product/countries.md: QR is available after verification in every non-sanctioned residence.
    // Occupied territories and age are checked during verification, not this country-only preview.
    const qr = known && !['KP', 'IR', 'CU', 'SY', 'RU', 'BY', 'MM'].includes(country)
    // Spending is the Peanut Card and QR payments (Hugo, 2026-10-10). Where neither is
    // offered, paying another Peanut user keeps the plan answerable.
    const spend: SetupPaymentChannel[] = [...(card ? ['card' as const] : []), ...(qr ? ['qr' as const] : [])]
    return {
        funding: [...bank, 'crypto', 'peanut'],
        payment: spend.length > 0 ? spend : ['peanut'],
    }
}
