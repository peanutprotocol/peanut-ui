'use client'

import { useMutation } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import { useAuth } from '@/context/authContext'
import { useSaveKycIntents } from '@/hooks/useSaveKycIntents'
import type { KycIntentKey } from '@/services/kyc-intents'
import { localizedCountryName } from '@/utils/country-name.utils'
import { addIntent, addOutcome, type AddOutcome } from '@/utils/one-shot-add.utils'
import { DOCUMENT_COUNTRY_UNSUPPORTED } from '@/utils/one-shot-card.utils'

/** The answer the sheet hands back; a refusal and a pending setup stay on the sheet. */
export type AddDone = Exclude<AddOutcome, { kind: 'refused' } | { kind: 'pending' }>

interface UnlockMethodAddStepProps {
    /** ISO-2 declared residence. */
    residence: string
    /** The feature of the intent set the tapped method stands for. */
    feature: KycIntentKey
    /** Display label of the tapped method row (already localized). */
    methodLabel: string | null
    /** The method is on, or is being set up: the sheet closes. */
    onDone: (outcome: AddDone) => void
    /** "Verify again with a {country} ID": the identity restart. */
    onVerifyAgain: () => void
    /** Tells the sheet a save is in flight, so it cannot be dismissed under it. */
    onSavingChange: (saving: boolean) => void
}

/**
 * The body of the method unlock sheet for a one-shot user who already passed
 * the identity check (TASK-23329, D16). The level collected everything at the
 * first check, so the tap adds the feature to the stored set and the API sets
 * it up with no new check: no ID question, no SDK, no list of what to have
 * ready. A refusal is said here, with the reason's own line; a document the
 * plan does not take offers a new check with an ID issued by the residence.
 * A setup the API could not start yet says to check back: the tick is saved.
 */
export const UnlockMethodAddStep = ({
    residence,
    feature,
    methodLabel,
    onDone,
    onVerifyAgain,
    onSavingChange,
}: UnlockMethodAddStepProps) => {
    const t = useTranslations('kyc')
    const tRows = useTranslations('profile.unlockPayments')
    const tCommon = useTranslations('common')
    const tIdentity = useTranslations('identity')
    const locale = useLocale()
    const { user } = useAuth()
    const save = useSaveKycIntents()
    // the server's set (item 3b), never the tab's: a second device may have added to it
    const stored = user?.identityVerification?.kycIntents
    const add = useMutation({
        mutationFn: async () => addOutcome(await save(addIntent(stored, feature)), feature),
        onSuccess: (outcome) => {
            if (outcome.kind !== 'refused' && outcome.kind !== 'pending') onDone(outcome)
        },
    })
    useEffect(() => {
        onSavingChange(add.isPending)
        return () => onSavingChange(false)
    }, [add.isPending, onSavingChange])
    const refused = add.data?.kind === 'refused' ? add.data : null
    const pending = add.data?.kind === 'pending'
    const reasonKey = reasonCodeKey(refused?.reason)
    const country = localizedCountryName(locale, residence, residence)

    return (
        <>
            <p className="w-full text-left text-body-m text-foreground-secondary">{t('unlock.addNote')}</p>
            {refused && (
                <Callout
                    priority="attention"
                    className="w-full"
                    title={methodLabel ?? undefined}
                    data-testid="unlock-method-refused"
                >
                    {reasonKey ? tIdentity(reasonKey, { country }) : tRows('chips.notAvailable')}
                </Callout>
            )}
            {pending && (
                <Callout
                    priority="info"
                    className="w-full"
                    title={methodLabel ?? undefined}
                    data-testid="unlock-method-pending"
                >
                    {t('unlock.checkBack')}
                </Callout>
            )}
            {add.isError && (
                <Callout priority="error" className="w-full">
                    {t('unlock.saveFailed')}
                </Callout>
            )}
            {refused?.reason === DOCUMENT_COUNTRY_UNSUPPORTED ? (
                <>
                    <p className="text-center text-body-s text-foreground-secondary">{t('setup.verifyAgainNote')}</p>
                    <Button variant="primary" shadowSize="4" className="w-full justify-center" onClick={onVerifyAgain}>
                        {t('setup.verifyAgain', { country })}
                    </Button>
                </>
            ) : (
                !refused &&
                !pending && (
                    <Button
                        icon="check-circle"
                        shadowSize="4"
                        variant="primary"
                        className="w-full justify-center"
                        disabled={add.isPending}
                        onClick={() => add.mutate()}
                    >
                        {add.isPending ? tCommon('loading') : t('unlock.addCta')}
                    </Button>
                )
            )}
        </>
    )
}
