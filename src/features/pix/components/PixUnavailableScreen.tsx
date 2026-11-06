'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { useAuth } from '@/context/authContext'
import { useModalsContext } from '@/context/ModalsContext'
import { pixRefusalCopy } from '@/features/pix/pixRoute.utils'
import { useSafeBack } from '@/hooks/useSafeBack'
import type { CapabilityRoute } from '@/types/capabilities'
import { buildContactSupportMessage } from '@/utils/contact-support.utils'

/**
 * Pix is not available to this user: the route is refused, or the API sent
 * none. It says why with the route's reason, in a localized line where this
 * build knows the reason, and offers support. No provider's screens show.
 */
export function PixUnavailableScreen({ title, route }: { title: string; route: CapabilityRoute | undefined }) {
    const t = useTranslations()
    const { openSupportWithMessage } = useModalsContext()
    const { user } = useAuth()
    const back = useSafeBack('/home')
    const reason = route?.reason
    const description = {
        rejected: t('pix.rejected'),
        'setup-failed': t('avenia.setup.notAvailable'),
        residence: t('pix.residenceNotServed'),
        'not-yet': t('pix.rolloutClosed'),
        down: t('avenia.unavailable'),
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
                                    buildContactSupportMessage({ reason, userId: user?.user?.userId })
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
