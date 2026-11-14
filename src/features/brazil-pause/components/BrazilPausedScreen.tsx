'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import CenteredStatusCard from '@/components/Global/EmptyStates/CenteredStatusCard'
import NavHeader from '@/components/Global/NavHeader'
import type { PixPayBlock } from '@/features/pix/pixRoute.utils'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useTranslations } from 'next-intl'
import { usePixPayBlockCopy } from '../usePixPayBlockCopy'

/**
 * The paused drawer as a page, for a flow reached by a link or a back step
 * rather than a tap the drawer catches: the Brazil pause, or a residence the
 * pay route does not serve. Same copy as `BrazilPausedDrawer`, as
 * `ResidenceRequiredScreen` mirrors `ClosedRowDrawer`.
 */
export function BrazilPausedScreen({ block }: { block: PixPayBlock }) {
    const copy = usePixPayBlockCopy(block)
    const tCommon = useTranslations('common')
    const back = useSafeBack('/home')

    return (
        <PageStack>
            <NavHeader onPrev={back} />
            <PageStack.Center>
                <CenteredStatusCard
                    tone="warning"
                    title={copy.title}
                    description={
                        <>
                            <p>{copy.body}</p>
                            {copy.keySend && <p className="mt-2">{copy.keySend}</p>}
                        </>
                    }
                >
                    <Button variant="primary" className="w-full" onClick={back}>
                        {tCommon('gotIt')}
                    </Button>
                </CenteredStatusCard>
            </PageStack.Center>
        </PageStack>
    )
}
