'use client'

import { useEffect, type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { STORE_URL } from '@/constants/migration.consts'
import { openExternalUrl } from '@/utils/capacitor'
import { useNativePlatform } from '@/utils/native-platform'
import { captureMessage } from '@/utils/sentry-lazy'
import type { UpdateRequired } from '@/utils/update-required'

// Inline styles, as on UnsupportedWebViewScreen: this screen replaces the whole app tree, so it
// must not depend on a provider or a stylesheet chunk that an old bundle may fail to load.
const styles = {
    root: {
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '32px 24px',
        boxSizing: 'border-box',
        background: '#ffffff',
        color: '#000000',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        textAlign: 'center',
    },
    title: { margin: 0, fontSize: '24px', lineHeight: 1.2, fontWeight: 700 },
    body: { margin: 0, maxWidth: '320px', fontSize: '16px', lineHeight: 1.5 },
    cta: {
        marginTop: '8px',
        padding: '12px 24px',
        border: '2px solid #000000',
        borderRadius: '9999px',
        background: '#000000',
        color: '#ffffff',
        fontSize: '16px',
        fontWeight: 700,
        cursor: 'pointer',
    },
} satisfies Record<string, CSSProperties>

let reported = false

/** Blocks the app once the API refuses this version (426 CLIENT_UPDATE_REQUIRED). */
export function UpdateRequiredScreen({ update }: UpdateRequired) {
    const t = useTranslations('updateRequired')
    const { platform } = useNativePlatform()
    const store = platform === 'android-native' ? 'android' : platform === 'ios-native' ? 'ios' : null
    // A too-old binary needs the store; on the web there is no store, a reload fetches the new bundle.
    const action = update === 'store' && store ? 'store' : 'reload'

    useEffect(() => {
        if (reported) return
        reported = true
        captureMessage('client update required: the API refused this app version', {
            level: 'info',
            tags: { client_update_required: update },
        })
    }, [update])

    return (
        <main style={styles.root}>
            <h1 style={styles.title}>{t('title')}</h1>
            <p style={styles.body}>{t(`body.${action}`)}</p>
            <button
                type="button"
                style={styles.cta}
                onClick={() =>
                    action === 'store' && store ? void openExternalUrl(STORE_URL[store]) : window.location.reload()
                }
            >
                {t(`cta.${action}`)}
            </button>
        </main>
    )
}

export default UpdateRequiredScreen
