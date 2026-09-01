'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Notification } from '@/components/0_Bruddle/Notification'
import NavHeader from '@/components/Global/NavHeader'
import KycPrepChecklist from '@/components/Kyc/KycPrepChecklist'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'
import { useBridgeHostedVerification } from '@/hooks/useBridgeHostedVerification'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useSafeBack } from '@/hooks/useSafeBack'

/**
 * "What to expect" screen in front of Bridge's hosted verification (Persona).
 * The tap used to hand the user straight to the vendor, which is the one flow
 * where that hurts: it runs at the vendor — the in-app browser sheet on
 * native, a new tab on web — and keeps no partial progress, so anyone who
 * leaves mid-way to find a document loses everything and starts over. It is a page rather than a sheet because the prep is the
 * whole content — a modal that needs scrolling to reach its own CTA reads as
 * an interruption, not as the step it actually is.
 *
 * The CTA calls `start` straight out of the click: the reserved tab depends on
 * that user gesture (see useBridgeHostedVerification).
 *
 * The task DISAPPEARING is the success signal — nothing else reports it, since
 * nothing polls a requires-info rail. The card this replaced got that for free
 * by unmounting; a route has to say something, or a returning user sits on a
 * live CTA whose only outcome is a 403 on an action that no longer exists.
 *
 * It says so IN PLACE rather than navigating. nextActions re-derives on every
 * user refetch and this screen can be polled (4s) while it is being read, so
 * any auto-exit has to decide whether a missing task is real or one bad tick —
 * and a wrong guess yanks a reader off the page mid-sentence. Swapping the
 * panel costs nothing if a later tick puts the task back, so the question
 * stops needing an answer.
 */
const IDENTITY_ROUTE = '/profile/identity-verification'

export const AdditionalVerificationView = (): React.JSX.Element => {
    const t = useTranslations('kyc.hostedPrep')
    const tPrep = useTranslations('kyc.prep')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const onBack = useSafeBack(IDENTITY_ROUTE)
    const { nextActions, isLoading: isLoadingCapabilities } = useCapabilities()
    const { start, isStarting, error } = useBridgeHostedVerification()
    const hostedTask = nextActions.find((action) => action.kind === 'bridge-hosted')
    // A future-dated action is advisory: those rails still work today, and this
    // screen must not tell that user their transfers are blocked.
    const isAdvisory = !!hostedTask?.effectiveDate

    // Loaded, and the task is gone: it was completed, or the partner stopped
    // asking. Either way there is nothing here to start.
    if (!isLoadingCapabilities && !hostedTask) {
        return (
            <div className="flex w-full flex-col gap-6">
                <NavHeader title={t('title')} onPrev={onBack} />
                <div className="flex flex-col items-center gap-3 text-center" data-testid="hosted-task-done">
                    <IconBubble icon="check-circle" size="l" color="green" />
                    <p className="text-body-m-semibold">{t('done.title')}</p>
                    <p className="text-body-s text-foreground-secondary">{t('done.description')}</p>
                </div>
                <Button variant="purple" shadowSize="4" onClick={() => router.replace(IDENTITY_ROUTE)}>
                    {t('done.cta')}
                </Button>
            </div>
        )
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <NavHeader title={t('title')} onPrev={onBack} />

            {/* Bubble centered, prose not: the checklist right below is
                left-aligned, and a centered paragraph above it reads as a
                second column. */}
            <div className="flex flex-col gap-3">
                <IconBubble icon="user-id" size="l" color="yellow" className="self-center" />
                <p className="text-body-s text-foreground-secondary">
                    {isAdvisory ? t('descriptionAdvisory') : t('description')}
                </p>
            </div>

            <KycPrepChecklist path="hosted" />

            <div className="flex flex-col gap-3">
                {/* Notification, not a bare <p>: it carries role="alert", so a
                    screen reader hears the failure instead of leaving focus on
                    a CTA that silently did nothing. */}
                {error && (
                    <Notification priority="error" data-testid="hosted-start-error">
                        {error}
                    </Notification>
                )}
                <Button
                    variant="purple"
                    shadowSize="4"
                    icon="check-circle"
                    iconPosition="left"
                    disabled={isStarting}
                    onClick={start}
                >
                    {isStarting ? tCommon('loading') : tPrep('startCta')}
                </Button>
                <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
            </div>
        </div>
    )
}
