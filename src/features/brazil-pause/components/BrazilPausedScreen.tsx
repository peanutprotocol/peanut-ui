'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import CenteredStatusCard from '@/components/Global/EmptyStates/CenteredStatusCard'
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
                <CenteredStatusCard tone="warning" title={t('title')} description={t('body')}>
                    <Button variant="primary" className="w-full" onClick={back}>
                        {tCommon('gotIt')}
                    </Button>
                </CenteredStatusCard>
            </PageStack.Center>
        </PageStack>
    )
}
