'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { LINK_BUTTON_CLASSES } from '@/components/0_Bruddle/LinkButton'
import { SetupDocLink } from '../components/SetupDocsDrawer'
import SetupFooter from '../components/SetupFooter'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSignupPasskey } from '@/features/setup/useSignupPasskey'
import { reserveUsername } from '@/features/setup/username-reservation'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { PasskeySetupHelpDrawer } from './PasskeySetupHelpDrawer'

export default function PasskeyStep() {
    const t = useTranslations('setup')
    const { username, setRefusedUsername } = useSetupFlowContext()
    const passkey = useSignupPasskey(username)
    const { setScreenId } = useSetupFlow()
    const { track } = useSignupControl()
    const refresh = useRef<{ username: string; request: ReturnType<typeof reserveUsername> }>()
    const registering = useRef(passkey.isClaiming)
    registering.current = passkey.isClaiming
    const navigate = useRef(setScreenId)
    navigate.current = setScreenId
    useEffect(() => {
        let active = true
        if (!/^[a-z][a-z0-9]{3,11}$/.test(username)) {
            navigate.current('signup')
            return
        }
        if (refresh.current?.username !== username) refresh.current = { username, request: reserveUsername(username) }
        void refresh.current.request.then((result) => {
            if (
                active &&
                !registering.current &&
                (result === 'taken' || result === 'refused' || result === 'invalid')
            ) {
                if (result === 'refused') setRefusedUsername(username)
                navigate.current('signup')
            }
        })
        return () => {
            active = false
        }
    }, [username, setRefusedUsername])

    const createPasskey = () => {
        track('create_passkey', 'tap')
        void passkey.claim()
    }
    const busy = passkey.isClaiming
    const message = passkey.inlineError ?? passkey.preflightWarning
    return (
        <>
            <div className="flex h-full flex-1 flex-col justify-between gap-6">
                <div className="flex flex-1 flex-col justify-center gap-4">
                    <BulletList
                        items={(['unlock', 'control', 'backup'] as const).map((point) => (
                            <div key={point} className="flex flex-col gap-0.5">
                                <p className="text-body-s-semibold text-foreground-primary">
                                    {t(`passkey.points.${point}.title`)}
                                </p>
                                <p className="short:hidden">{t(`passkey.points.${point}.description`)}</p>
                            </div>
                        ))}
                    />
                    {passkey.usernameTaken && (
                        <div className="flex flex-col gap-3">
                            <Callout priority="error">{t('passkey.usernameTaken')}</Callout>
                            <Button
                                variant="secondary"
                                loading={passkey.isLoggingIn}
                                disabled={passkey.isLoggingIn}
                                onClick={() => {
                                    track('log_in', 'tap')
                                    void passkey.logIn()
                                }}
                                shadowSize="4"
                            >
                                {t('logIn')}
                            </Button>
                        </div>
                    )}
                    {message && <Callout priority="error">{message}</Callout>}
                </div>
                <SetupFooter
                    actions={
                        <Button
                            size="medium"
                            className="w-full"
                            loading={busy}
                            disabled={busy}
                            shadowSize="4"
                            onClick={createPasskey}
                            aria-label={t('passkey.create')}
                        >
                            {t('passkey.create')}
                        </Button>
                    }
                    secondary={
                        <SetupDocLink
                            kind="passkeys"
                            href="/en/help/passkeys"
                            className={`${LINK_BUTTON_CLASSES} w-full justify-center`}
                        >
                            {t('passkey.learnMore')}
                        </SetupDocLink>
                    }
                />
            </div>
            {passkey.helpErrorName && (
                <PasskeySetupHelpDrawer
                    visible={passkey.isHelpOpen}
                    errorName={passkey.helpErrorName}
                    platform={passkey.deviceType}
                    onClose={() => {
                        track('passkey_help', 'dismiss')
                        passkey.closeHelp()
                    }}
                    onRetry={() => {
                        track('passkey_help_retry', 'tap')
                        passkey.retryFromHelp()
                    }}
                    onSupport={() => track('passkey_help_support', 'tap')}
                />
            )}
        </>
    )
}
