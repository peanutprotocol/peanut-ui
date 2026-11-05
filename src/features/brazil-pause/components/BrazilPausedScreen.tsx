'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useTranslations } from 'next-intl'

/**
 * The Brazil paused drawer as a page, for a Brazil flow reached by a link or
 * a back step rather than a tap the drawer catches. Same copy as
 * `BrazilPausedDrawer`, as `ResidenceRequiredScreen` mirrors `ClosedRowDrawer`.
 */
export function BrazilPausedScreen() {
    const t = useTranslations('brazilPause')
    const tCommon = useTranslations('common')
    const back = useSafeBack('/home')

    return (
        <PageStack>
            <NavHeader onPrev={back} />
            <PageStack.Center>
                <EmptyState
                    icon="clock"
                    title={t('title')}
                    description={t('body')}
                    cta={
                        <Button variant="primary" className="mt-4 w-full" onClick={back}>
                            {tCommon('gotIt')}
                        </Button>
                    }
                />
            </PageStack.Center>
        </PageStack>
    )
}
