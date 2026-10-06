'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import KycPrepChecklist, { type KycPrepPath } from '@/components/Kyc/KycPrepChecklist'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'
import { UnlockIdQuestion } from '@/components/Kyc/UnlockIdQuestion'
import { useUnlockChecklist } from '@/components/Kyc/useUnlockChecklist'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import type { KycIntentKey } from '@/services/kyc-intents'
import { localizedCountryName } from '@/utils/country-name.utils'

interface UnlockMethodOneShotStepProps {
    /** ISO-2 declared residence. */
    residence: string
    /** The feature of the intent set the tapped method stands for. */
    feature: KycIntentKey
    /** Display label of the tapped method row (already localized). */
    methodLabel: string | null
    path: KycPrepPath
    /** The SDK start is in flight. */
    isLoading: boolean
    /** Starts the identity check, once the set is stored. */
    onUnlock: () => void
}

/**
 * The body of the method unlock sheet for a one-shot user who has not passed
 * the identity check (TASK-23329, D16). The tap already names the feature, so
 * there is no checklist: the sheet asks which ID the user will show, stores
 * the tapped feature and QR, and starts the check. When that ID cannot open
 * the method, the sheet says why before the photo and offers the check for QR
 * payments alone, as the unlock checklist does.
 */
export const UnlockMethodOneShotStep = ({
    residence,
    feature,
    methodLabel,
    path,
    isLoading,
    onUnlock,
}: UnlockMethodOneShotStepProps) => {
    const t = useTranslations('kyc.unlock')
    const tPrep = useTranslations('kyc.prep')
    const tRows = useTranslations('profile.unlockPayments')
    const tCommon = useTranslations('common')
    const tIdentity = useTranslations('identity')
    const locale = useLocale()
    const checklist = useUnlockChecklist(residence, onUnlock, feature)
    const busy = isLoading || checklist.save.isPending
    const row = checklist.rows.find((candidate) => candidate.key === feature)
    const refused = checklist.isReady && !row?.available
    // a row the checklist hides (a residence rule) has no line of its own
    const reasonKey = reasonCodeKey(row?.reason)
    const country = localizedCountryName(locale, residence, residence)

    return (
        <>
            <div className="w-full text-left">
                <UnlockIdQuestion residence={residence} checklist={checklist} />
            </div>
            {checklist.isError && (
                <Callout
                    priority="error"
                    className="w-full"
                    ctas={[{ label: tCommon('tryAgain'), onClick: () => void checklist.refetch() }]}
                >
                    {t('loadFailed')}
                </Callout>
            )}
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
            <div className="w-full text-left">
                <KycPrepChecklist path={path} />
            </div>
            <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
            {checklist.save.isError && (
                <Callout priority="error" className="w-full">
                    {t('saveFailed')}
                </Callout>
            )}
            <Button
                icon="check-circle"
                shadowSize="4"
                variant="primary"
                className="w-full justify-center"
                disabled={busy || !checklist.canContinue}
                onClick={() => checklist.save.mutate(checklist.intents)}
            >
                {/* a refused method leaves QR, the one feature every check opens */}
                {busy ? tCommon('loading') : refused && checklist.canContinue ? t('ctaQrOnly') : tPrep('startCta')}
            </Button>
        </>
    )
}
