'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { MASCOT_STATE_CLASS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { openStore } from '@/utils/migration.utils'
import type { StoreUpdatePlatform } from '@/utils/store-update'

/**
 * Full-screen, no way past it: this native build is below the remote update
 * floor (features/app-update/force-update.ts) and its store offers the fix.
 */
export default function ForceUpdateScreen({ platform }: { platform: StoreUpdatePlatform }) {
    const t = useTranslations('appUpdateAttention')
    return (
        <main className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-background-page p-6">
            <PeanutMascot pose="waving-hello" className={MASCOT_STATE_CLASS} />
            <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-heading-s">{t('title')}</h1>
                <p className="max-w-md text-body-s">{t('requiredDescription')}</p>
            </div>
            <Button
                shadowSize="4"
                className="w-full"
                onClick={() => openStore(platform, MIGRATION_SURFACES.FORCE_UPDATE)}
            >
                {t('updateNow')}
            </Button>
        </main>
    )
}
