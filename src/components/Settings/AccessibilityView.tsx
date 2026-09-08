'use client'

import Card from '@/components/Global/Card'
import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import NavHeader from '@/components/Global/NavHeader'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useAccessibility } from '@/hooks/useAccessibility'
import type { MotionPreference } from '@/utils/accessibility-preferences'
import { Button } from '@/components/0_Bruddle/Button'
import { useModalsContext } from '@/context/ModalsContext'

function PreferenceToggle({
    title,
    description,
    checked,
    onChange,
}: {
    title: string
    description: string
    checked: boolean
    onChange: (checked: boolean) => void
}) {
    const id = useId()
    return (
        <div className="flex items-center justify-between gap-4 border-b border-border-disabled py-4 last:border-b-0">
            <div className="min-w-0">
                <p id={`${id}-title`} className="text-body-m-semibold">
                    {title}
                </p>
                <p id={`${id}-description`} className="mt-1 text-body-s text-foreground-secondary">
                    {description}
                </p>
            </div>
            <Toggle
                checked={checked}
                onChange={onChange}
                aria-labelledby={`${id}-title`}
                aria-describedby={`${id}-description`}
            />
        </div>
    )
}

export function AccessibilityView() {
    const t = useTranslations('settings.accessibility')
    const preferences = useAccessibility()
    const { setIsSupportModalOpen } = useModalsContext()
    const onBack = useSafeBack('/profile')
    return (
        <PageStack gap="6" className="h-full bg-background">
            <NavHeader title={t('title')} onPrev={onBack} />
            <Card className="bg-background-default px-4 py-0">
                <PreferenceToggle
                    title={t('largerText')}
                    description={t('largerTextDescription')}
                    checked={preferences.largerText}
                    onChange={(largerText) => preferences.updatePreferences({ largerText })}
                />
                <div className="border-b border-border-disabled py-4">
                    <label htmlFor="accessibility-motion" className="text-body-m-semibold">
                        {t('reduceMotion')}
                    </label>
                    <p id="accessibility-motion-description" className="mt-1 text-body-s text-foreground-secondary">
                        {t('reduceMotionDescription')}
                    </p>
                    <select
                        id="accessibility-motion"
                        aria-describedby="accessibility-motion-description"
                        value={preferences.motion}
                        onChange={(event) =>
                            preferences.updatePreferences({ motion: event.target.value as MotionPreference })
                        }
                        className="input mt-3 w-full"
                    >
                        <option value="system">{t('motionSystem')}</option>
                        <option value="on">{t('on')}</option>
                        <option value="off">{t('off')}</option>
                    </select>
                </div>
                <PreferenceToggle
                    title={t('highContrast')}
                    description={t('highContrastDescription')}
                    checked={preferences.highContrast}
                    onChange={(highContrast) => preferences.updatePreferences({ highContrast })}
                />
                <PreferenceToggle
                    title={t('simplifiedConfirmations')}
                    description={t('simplifiedConfirmationsDescription')}
                    checked={preferences.simplifiedConfirmations}
                    onChange={(simplifiedConfirmations) => preferences.updatePreferences({ simplifiedConfirmations })}
                />
            </Card>
            <section aria-labelledby="accessibility-preview">
                <Card className="bg-background-default p-4">
                    <h2 id="accessibility-preview" className="text-heading-card">
                        {t('preview')}
                    </h2>
                    <p className="mt-2 text-body-m">{t('previewText')}</p>
                </Card>
            </section>
            <section aria-labelledby="accessibility-help" className="space-y-2">
                <h2 id="accessibility-help" className="text-heading-card">
                    {t('deviceFeatures')}
                </h2>
                <p className="text-body-s text-foreground-secondary">{t('deviceFeaturesDescription')}</p>
                <p className="text-body-s text-foreground-secondary">{t('alwaysOnDescription')}</p>
            </section>
            <Button variant="stroke" onClick={() => setIsSupportModalOpen(true)}>
                {t('reportIssue')}
            </Button>
        </PageStack>
    )
}
