'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { useAuth } from '@/context/authContext'
import { useModalsContext } from '@/context/ModalsContext'
import { pixRefusalCopy } from '@/features/pix/pixRoute.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useSafeBack } from '@/hooks/useSafeBack'
import type { CapabilityRoute } from '@/types/capabilities'
import { buildContactSupportMessage } from '@/utils/contact-support.utils'

/**
 * Pix is not available to this user: the route is refused, or the API sent
 * none, or the setup step needs support to finish. It says why with the
 * route's reason, in a localized line where this build knows the reason, and
 * offers support. `description` replaces that line; `onBack` the way back.
 */
export function PixUnavailableScreen({
    title,
    route,
    description: line,
    onBack,
}: {
    title: string
    route: CapabilityRoute | undefined
    description?: string
    onBack?: () => void
}) {
    const t = useTranslations()
    const { openSupportWithMessage } = useModalsContext()
    const { user } = useAuth()
    const { nextActions } = useCapabilities()
    const safeBack = useSafeBack('/home')
    const back = onBack ?? safeBack
    const reason = route?.reason
    // the support step the route names tells support which case this is, with the reason
    const supportAction = nextActions.find(
        (action) => action.key === route?.action && action.kind === 'contact-support'
    )
    const description =
        line ??
        {
            rejected: t('pix.rejected'),
            'setup-failed': t('pix.setup.notAvailable'),
            residence: t('pix.residenceNotServed'),
            'not-yet': t('pix.rolloutClosed'),
            down: t('pix.unavailable'),
            'not-served': t('pix.methodNotServed'),
            reason: reason?.userMessage ?? '',
        }[pixRefusalCopy(reason)]
    return (
        <PageStack>
            <NavHeader title={title} onPrev={back} />
            <PageStack.Center>
                <EmptyState
                    icon="alert"
                    title={t('pix.unavailableTitle')}
                    description={description}
                    cta={
                        <Button
                            variant="primary"
                            className="mt-4 w-full"
                            // the route's reason tells support which case this is
                            onClick={() =>
                                openSupportWithMessage(
                                    buildContactSupportMessage({
                                        reason,
                                        userId: user?.user?.userId,
                                        purpose: supportAction?.purpose,
                                    })
                                )
                            }
                        >
                            {t('common.contactSupport')}
                        </Button>
                    }
                />
            </PageStack.Center>
        </PageStack>
    )
}
