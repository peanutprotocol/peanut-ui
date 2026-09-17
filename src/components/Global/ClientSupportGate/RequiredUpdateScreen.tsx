'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { DOCUMENT_CACHE_PATTERNS } from '@/constants/cache.consts'
import { STORE_NAME, STORE_URL } from '@/constants/migration.consts'
import { useOtaUpdate } from '@/context/OtaUpdateContext'
import { isStandalonePwa, purgeCaches } from '@/utils/cache.utils'
import { getPlatform, openExternalUrl } from '@/utils/capacitor'
import type { OtaCheckOutcome } from '@/utils/capgo-updater'

/**
 * The running bundle is below its platform's support floor. Nothing here
 * dismisses: the only way out is a bundle whose generation the policy accepts,
 * which means a restart onto a newer one — the screen never unlocks on an OTA
 * outcome by itself, the policy check on the next launch decides.
 *
 * Native offers whatever the updater already has (a staged bundle to restart
 * onto, or a store-only verdict), and otherwise asks it for one; the store is
 * the fallback when no over-the-air bundle can satisfy the floor. Web and PWA
 * reload the document, which picks up the current deployment. Every action is
 * a tap — no automatic reload, so a floor that outruns the deploy cannot loop.
 *
 * Composition precedent: OfflineScreen / BackendErrorScreen (hero + title
 * block + CTAs); the full cover is AppLock's `fixed inset-0 z-[9999]`.
 * code-only ❓: no figma board for a required-update screen yet.
 */
export function RequiredUpdateScreen() {
    const t = useTranslations('clientSupport')
    const tUpdate = useTranslations('profile.update')
    const tStore = useTranslations('profile.storeUpdate')
    const tCommon = useTranslations('common')
    const { pendingBundle, storeUpdateRequired, applyState, applyNow, checkNow } = useOtaUpdate()
    const platform = getPlatform()
    const store = platform === 'ios-native' ? 'ios' : 'android'
    const native = platform === 'ios-native' || platform === 'android-native'
    const [checking, setChecking] = useState(false)
    const [checkOutcome, setCheckOutcome] = useState<OtaCheckOutcome | 'unavailable' | null>(null)

    const openStore = () => void openExternalUrl(STORE_URL[store])
    const reload = () => {
        // Same recipe as useStaleDeploymentReload: drop the worker's document
        // caches first, and keep an installed PWA inside its own window.
        void purgeCaches(DOCUMENT_CACHE_PATTERNS).then(() => {
            if (isStandalonePwa()) window.location.replace(window.location.href)
            else window.location.reload()
        })
    }
    const check = async () => {
        setChecking(true)
        try {
            setCheckOutcome(await checkNow())
        } finally {
            setChecking(false)
        }
    }

    let description: string
    let ctas: React.ReactNode
    if (!native) {
        description = t('reload')
        ctas = (
            <Button variant="purple" className="w-full" icon="retry" onClick={reload}>
                {t('reloadNow')}
            </Button>
        )
    } else if (applyState === 'manual-restart') {
        // The plugin has the bundle and the page outlived the reload: the user
        // closes the app themselves. Nothing left to tap.
        description = tUpdate('manualRestart')
        ctas = null
    } else if (storeUpdateRequired) {
        description = t('storeOnly', { store: STORE_NAME[store] })
        ctas = (
            <Button variant="purple" className="w-full" icon="download" onClick={openStore}>
                {tStore('openStore', { store: STORE_NAME[store] })}
            </Button>
        )
    } else if (pendingBundle) {
        const applying = applyState === 'applying'
        const failed = applyState === 'failed'
        description = failed ? tUpdate('applyFailed') : t('restart')
        ctas = (
            <Button
                variant="purple"
                className="w-full"
                icon="download"
                loading={applying}
                disabled={applying}
                onClick={() => void applyNow()}
            >
                {failed ? tCommon('tryAgain') : tUpdate('restartNow')}
            </Button>
        )
    } else {
        // Nothing staged yet. A check that comes back empty or broken leaves
        // the store as the way forward, with the check still retriable.
        const empty = checkOutcome === 'up-to-date' || checkOutcome === 'unavailable'
        const failed = checkOutcome === 'failed'
        description = empty ? t('noOtaYet', { store: STORE_NAME[store] }) : failed ? t('checkFailed') : t('check')
        ctas = (
            <>
                <Button
                    variant={empty ? 'stroke' : 'purple'}
                    className="w-full"
                    icon="retry"
                    loading={checking}
                    disabled={checking}
                    onClick={() => void check()}
                >
                    {checkOutcome === null ? t('checkForUpdate') : tCommon('tryAgain')}
                </Button>
                {(empty || failed) && (
                    <Button variant={empty ? 'purple' : 'stroke'} className="w-full" onClick={openStore}>
                        {tStore('openStore', { store: STORE_NAME[store] })}
                    </Button>
                )}
            </>
        )
    }

    return (
        <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 bg-background-page p-6">
            <IconBubble icon="download" size="l" color="blue" />
            <TitleBlock align="center" size="s" title={t('title')} description={description} />
            {ctas && <div className="flex w-full max-w-md flex-col gap-4">{ctas}</div>}
        </main>
    )
}
