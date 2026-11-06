'use client'

import { useTranslations } from 'next-intl'
import { MantecaAccountUnavailable } from '@/components/Common/MantecaAccountUnavailable'
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
        'not-offered': t('avenia.unavailable'),
        reason: reason?.userMessage ?? '',
    }[pixRefusalCopy(reason)]
    return (
        <MantecaAccountUnavailable
            title={title}
            description={description}
            onBack={back}
            // the route's reason tells support which case this is
            onSupport={() => openSupportWithMessage(buildContactSupportMessage({ reason, userId: user?.user?.userId }))}
        />
    )
}
