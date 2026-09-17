'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { PeanutCheering } from '@/assets/mascot'
import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import NavHeader from '@/components/Global/NavHeader'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { useDepositAccountCopy } from '../useDepositAccountCopy'

export function AccountOpenedScreen({ currency, onContinue }: { currency: string; onContinue: () => void }) {
    const { t } = useDepositAccountCopy()
    const celebrated = useRef(false)

    useEffect(() => {
        if (celebrated.current) return
        celebrated.current = true
        shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.4 } })
    }, [])

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onContinue} />
            <div className="flex flex-col items-center gap-6 text-center">
                <Image src={PeanutCheering} alt="" width={200} height={200} unoptimized />
                <TitleBlock
                    size="s"
                    title={<h1>{t('opened.heading', { currency })}</h1>}
                    description={t('opened.body')}
                />
            </div>
            <PageStack.Footer>
                <Button variant="purple" className="w-full" onClick={onContinue}>
                    {t('opened.cta')}
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}
