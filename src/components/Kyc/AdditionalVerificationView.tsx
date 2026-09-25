'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { Callout } from '@/components/0_Bruddle/Callout'
import NavHeader from '@/components/Global/NavHeader'
import KycPrepChecklist from '@/components/Kyc/KycPrepChecklist'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'
import { useHostedVerification } from '@/hooks/useHostedVerification'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useSafeBack } from '@/hooks/useSafeBack'
import { hasNativeBridgeStep, selectBridgeTasks } from '@/utils/bridge-tasks.utils'

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
 * that user gesture (see useHostedVerification).
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
 *
 * Coming back from the vendor opens the hook's settle window: the CTA is held
 * while the app asks the provider for the result, and if the task is still
 * pending when the window ends the screen says so instead of re-offering the
 * same button in silence — that silence is what sent users through the check
 * again and again (TASK-22818).
 */
const IDENTITY_ROUTE = '/profile/accounts-and-payments'

export const AdditionalVerificationView = (): React.JSX.Element => {
    const t = useTranslations('kyc.hostedPrep')
    const tPrep = useTranslations('kyc.prep')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const onBack = useSafeBack(IDENTITY_ROUTE)
    const { nextActions, rails, isLoading: isLoadingCapabilities } = useCapabilities()
    // Same selection as the Home card: a hosted task stands down while a Bridge
    // rail carries a native step, so a deep link here reads the same truth.
    const hostedTask = selectBridgeTasks(nextActions, rails ?? []).find((action) => action.kind === 'bridge-hosted')
    // The hosted task stood down because a Bridge rail carries a Sumsub step:
    // the document Bridge asked for is collected in the app, not at the vendor.
    const nativeStepPending = !hostedTask && hasNativeBridgeStep(nextActions, rails ?? [])
    const { start, isStarting, error, isSettling, stillPendingAfterReturn } = useHostedVerification('bridge-hosted', {
        taskPending: !!hostedTask,
    })
    // A future-dated action is advisory: those rails still work today, and this
    // screen must not tell that user their transfers are blocked.
    const isAdvisory = !!hostedTask?.effectiveDate

    // Loaded, and there is no hosted task to start. Either the app collects
    // the item itself (say so, and point at the upload) or the task is gone:
    // completed, or the partner stopped asking.
    if (!isLoadingCapabilities && !hostedTask) {
        const panel = nativeStepPending ? 'nativeInstead' : 'done'
        return (
            <PageStack gap="6">
                <NavHeader title={t('title')} onPrev={onBack} />
                <PageStack.Center>
                    <Card
                        className="flex flex-col items-center gap-3 p-4 text-center"
                        data-testid={nativeStepPending ? 'hosted-task-native-instead' : 'hosted-task-done'}
                    >
                        <IconBubble
                            icon={nativeStepPending ? 'user-id' : 'check-circle'}
                            size="l"
                            color={nativeStepPending ? 'yellow' : 'green'}
                        />
                        <p className="text-body-m-semibold">{t(`${panel}.title`)}</p>
                        <p className="text-body-s text-foreground-secondary">{t(`${panel}.description`)}</p>
                        <Button
                            variant="primary"
                            shadowSize="4"
                            className="mt-1"
                            onClick={() => router.replace(IDENTITY_ROUTE)}
                        >
                            {t(`${panel}.cta`)}
                        </Button>
                    </Card>
                </PageStack.Center>
            </PageStack>
        )
    }

    return (
        <PageStack gap="6">
            <NavHeader title={t('title')} onPrev={onBack} />

            <PageStack.Center>
                {/* Bubble centered, prose not: the checklist right below is
                    left-aligned, and a centered paragraph above it reads as a
                    second column. */}
                <Card className="gap-3 p-4">
                    <IconBubble {...CONCEPT_ICONS.verification} size="l" className="self-center" />
                    <p className="text-body-s text-foreground-secondary">
                        {isAdvisory ? t('descriptionAdvisory') : t('description')}
                    </p>
                    <KycPrepChecklist path="hosted" />
                    {/* Callout, not a bare <p>: it carries role="alert", so a
                        screen reader hears the failure instead of leaving focus on
                        a CTA that silently did nothing. */}
                    {error && (
                        <Callout priority="error" data-testid="hosted-start-error">
                            {error}
                        </Callout>
                    )}
                    {isSettling && (
                        <Callout priority="info" data-testid="hosted-settling">
                            {t('checking')}
                        </Callout>
                    )}
                    {stillPendingAfterReturn && !isSettling && (
                        <Callout priority="attention" data-testid="hosted-still-pending">
                            {t('stillPending')}
                        </Callout>
                    )}
                    <Button
                        variant="primary"
                        shadowSize="4"
                        icon="check-circle"
                        iconPosition="left"
                        disabled={isStarting || isSettling}
                        onClick={start}
                    >
                        {isStarting ? tCommon('loading') : tPrep('startCta')}
                    </Button>
                </Card>
            </PageStack.Center>

            <PageStack.Footer>
                <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
            </PageStack.Footer>
        </PageStack>
    )
}
