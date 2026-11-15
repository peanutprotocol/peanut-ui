import type { ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { deriveResidenceRestrictionsFrom, isQrResidenceRestricted } from '@/utils/residence-restrictions'
import type { IconConcept } from '@/components/0_Bruddle/conceptIcons'
import type { KycFeatures } from '@/app/actions/types/kyc-workflow.types'
import type { KycIntents } from '@/hooks/useKycIntents'
import { LOCAL_SERVED_ELSEWHERE_REASON } from '@/features/kyc-features/report'
export type SetupFundingChannel = 'bank' | 'brlBank' | 'arsBank' | 'crypto' | 'peanut'
export type SetupPaymentChannel = Exclude<SetupFundingChannel, 'brlBank' | 'arsBank'> | 'card' | 'qr'
export type SetupChannel = SetupFundingChannel | SetupPaymentChannel
export const SETUP_CHANNEL_CONCEPTS: Record<SetupChannel, IconConcept> = {
    bank: 'bank',
    brlBank: 'bank',
    arsBank: 'bank',
    qr: 'qrPay',
    card: 'card',
    crypto: 'crypto',
    peanut: 'friends',
}
export function setupChannelsForResidence(
    sets: ResidenceRestrictionSets | null,
    residence: string,
    settled: boolean,
    intents?: KycIntents
): { funding: SetupFundingChannel[]; payment: SetupPaymentChannel[] } {
    const country = residence.trim().toUpperCase()
    const known = settled && !!country && (!!intents || sets !== null)
    // The server's answer (GET /config/kyc-intents) when it arrived; the restriction tiers otherwise.
    const restrictions = sets ? deriveResidenceRestrictionsFrom(sets, country) : null
    const bridge = known && (intents ? intents.bank.available : !restrictions?.banking)
    // a local refusal because another entry serves the residence still offers its bank: Brazil's Pix
    const localOpen =
        known &&
        (intents
            ? intents.local.available || intents.local.reason === LOCAL_SERVED_ELSEWHERE_REASON
            : !restrictions?.banking)
    const local: SetupFundingChannel[] =
        localOpen && country === 'BR' ? ['brlBank'] : localOpen && country === 'AR' ? ['arsBank'] : []
    const bank: SetupFundingChannel[] = [...local, ...(bridge ? (['bank'] as const) : [])]
    const card = known && (intents ? intents.card.available : !restrictions?.card)
    const qr = known && (intents ? intents.qr.available : sets !== null && !isQrResidenceRestricted(sets, country))
    // Spending is the Peanut Card and QR payments (Hugo, 2026-10-10). Where neither is
    // offered, paying another Peanut user keeps the plan answerable.
    const spend: SetupPaymentChannel[] = [...(card ? ['card' as const] : []), ...(qr ? ['qr' as const] : [])]
    return {
        funding: [...bank, 'crypto', 'peanut'],
        payment: spend.length > 0 ? spend : ['peanut'],
    }
}

/**
 * The features a payment plan asks for. The API derives them from the same
 * pair at signup (intentsFromSignupPreferences); QR comes with every approval.
 */
export function featuresFromPaymentPlan(funding: SetupFundingChannel, payment: SetupPaymentChannel): KycFeatures {
    return {
        qr: true,
        bank: funding === 'bank' || payment === 'bank',
        local: funding === 'brlBank' || funding === 'arsBank',
        card: payment === 'card',
    }
}
