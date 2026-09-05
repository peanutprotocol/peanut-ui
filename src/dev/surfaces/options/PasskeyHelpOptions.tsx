'use client'

/**
 * PasskeySetupHelpModal — the four reworks, as real renders.
 *
 * Harness-only: these live under src/dev/surfaces so the options can be
 * photographed with the real DS components and the real catalog strings before
 * one of them is promoted into the component itself. Every variant shows the
 * Android `notAllowed` case, which is the densest one and the reason the screen
 * was flagged.
 */

import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Notification } from '@/components/0_Bruddle/Notification'
import { NumberedList } from '@/components/0_Bruddle/NumberedList'
import { Accordion } from '@/components/0_Bruddle/Accordion'

const MINI = 'text-label-m uppercase tracking-wide text-foreground-secondary'
const STEP_KEYS = ['ensureSignedInGoogle', 'updatePlayServices', 'enableScreenLockSettings', 'restartApp'] as const

function useHelpCopy() {
    const t = useTranslations('setup.passkey.help')
    return {
        t,
        title: t('titles.notAllowed'),
        description: t('descriptions.notAllowedAndroid'),
        steps: STEP_KEYS.map((k) => t(`steps.${k}` as Parameters<typeof t>[0])),
        warning: t('warnings.lowEndAndroid'),
    }
}

function Shell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
    const { title } = useHelpCopy()
    const tCommon = useTranslations('common')
    return (
        <ActionModal
            visible
            onClose={() => {}}
            icon="alert"
            iconContainerClassName="bg-action-secondary"
            iconProps={{ className: 'text-foreground-primary' }}
            title={title}
            modalPanelClassName="max-w-md mx-8"
            content={children}
            footer={
                footer ?? (
                    <Button icon="retry" shadowSize="4" className="w-full justify-center">
                        {tCommon('retry')}
                    </Button>
                )
            }
        />
    )
}

/** A — numbered list for the fixes, one Notification for the one real warning. */
export function PasskeyHelpA() {
    const { t, description, steps, warning } = useHelpCopy()
    const tCommon = useTranslations('common')
    return (
        <Shell
            footer={
                <div className="flex w-full flex-col items-center gap-3">
                    <Button icon="retry" shadowSize="4" className="w-full justify-center">
                        {tCommon('retry')}
                    </Button>
                    <LinkButton href="https://peanut.me/support">{t('stillHavingIssues')}</LinkButton>
                </div>
            }
        >
            <div className="flex w-full flex-col gap-4 text-left">
                <p className="text-body-s text-foreground-secondary">{description}</p>
                <div className="flex flex-col gap-2">
                    <h2 className={MINI}>{t('tryTheseFixes')}</h2>
                    <NumberedList items={steps} />
                </div>
                <Notification priority="attention">{warning}</Notification>
            </div>
        </Shell>
    )
}

/** B — minimal bullets, no Notification; the caveat folded into the copy. */
export function PasskeyHelpB() {
    const { t, description, steps, warning } = useHelpCopy()
    return (
        <Shell>
            <div className="flex w-full flex-col gap-4 text-left">
                <p className="text-body-s text-foreground-secondary">
                    {description} {warning}
                </p>
                <div className="flex flex-col gap-2">
                    <h2 className={MINI}>{t('tryTheseFixes')}</h2>
                    <ul className="flex flex-col gap-2">
                        {steps.map((step) => (
                            <li key={step} className="flex items-start gap-2 text-body-s text-foreground-primary">
                                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground-primary" />
                                <span>{step}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </Shell>
    )
}

/** C — one Notification carrying the heading, the fixes and the caveat. */
export function PasskeyHelpC() {
    const { t, description, steps, warning } = useHelpCopy()
    return (
        <Shell>
            <div className="flex w-full flex-col gap-4 text-left">
                <p className="text-body-s text-foreground-secondary">{description}</p>
                <Notification
                    priority="info"
                    className="w-full"
                    title={t('tryTheseFixes')}
                    items={[...steps, warning]}
                />
            </div>
        </Shell>
    )
}

/** D — one line and the button; everything else behind an accordion. */
export function PasskeyHelpD() {
    const { t, description, steps, warning } = useHelpCopy()
    return (
        <Shell>
            <div className="flex w-full flex-col gap-4 text-left">
                <p className="text-body-s text-foreground-secondary">{description}</p>
                <Accordion type="single" collapsible className="w-full">
                    <Accordion.Item value="fixes">
                        <Accordion.Trigger>{t('tryTheseFixes')}</Accordion.Trigger>
                        <Accordion.Content>
                            <div className="flex flex-col gap-3 px-4 pb-4">
                                <NumberedList items={steps} />
                                <p className="text-body-xs text-foreground-secondary">{warning}</p>
                            </div>
                        </Accordion.Content>
                    </Accordion.Item>
                </Accordion>
            </div>
        </Shell>
    )
}
