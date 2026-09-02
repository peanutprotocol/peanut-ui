'use client'

import { useEffect, type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { getPlatform, openExternalUrl } from '@/utils/capacitor'
import { captureMessage } from '@/utils/sentry-lazy'

const BYPASS_KEY = 'unsupportedWebViewBypass'

/** A session-scoped escape hatch, so a canary false positive never locks the app. */
export function hasUnsupportedWebViewBypass(): boolean {
    try {
        return window.sessionStorage.getItem(BYPASS_KEY) === '1'
    } catch {
        return false
    }
}

function continueAnyway(): void {
    try {
        window.sessionStorage.setItem(BYPASS_KEY, '1')
    } catch {}
    window.location.reload()
}

const ANDROID_WEBVIEW_STORE_URL = 'https://play.google.com/store/apps/details?id=com.google.android.webview'
const IOS_UPDATE_HELP_URL = 'https://support.apple.com/HT204204'

// Inline styles only: this screen exists because the stylesheet cannot be
// parsed, so no Tailwind class resolves here.
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
    secondary: {
        marginTop: '4px',
        padding: '8px',
        border: 'none',
        background: 'transparent',
        color: '#5f646d',
        fontSize: '14px',
        textDecoration: 'underline',
        cursor: 'pointer',
    },
} satisfies Record<string, CSSProperties>

let reported = false

export function UnsupportedWebViewScreen() {
    const t = useTranslations('unsupportedWebView')
    const platform = getPlatform() === 'android-native' ? 'android' : 'ios'

    useEffect(() => {
        if (reported) return
        reported = true
        captureMessage('unsupported webview: required CSS features missing', {
            level: 'warning',
            tags: { unsupported_webview: 'true' },
            extra: { userAgent: navigator.userAgent },
        })
    }, [])

    return (
        <main style={styles.root}>
            <h1 style={styles.title}>{t('title')}</h1>
            <p style={styles.body}>{t(`body.${platform}`)}</p>
            <button
                type="button"
                style={styles.cta}
                onClick={() =>
                    void openExternalUrl(platform === 'android' ? ANDROID_WEBVIEW_STORE_URL : IOS_UPDATE_HELP_URL)
                }
            >
                {t(`cta.${platform}`)}
            </button>
            <button type="button" style={styles.secondary} onClick={continueAnyway}>
                {t('continueAnyway')}
            </button>
        </main>
    )
}

export default UnsupportedWebViewScreen
