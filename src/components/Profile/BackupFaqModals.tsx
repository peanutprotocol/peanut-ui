'use client'

import { useTranslations } from 'next-intl'
import { MiniHeader } from '@/components/0_Bruddle/MiniHeader'
import { Notification } from '@/components/0_Bruddle/Notification'
import { NumberedList } from '@/components/0_Bruddle/NumberedList'
import ActionModal from '@/components/Global/ActionModal'

export type BackupFaq = 'lose-phone' | 'change-phone' | 'export-keys' | null

interface BackupFaqModalsProps {
    active: BackupFaq
    onClose: () => void
    /** 'android' | 'ios' — the platform name the copy interpolates. */
    platform: string
}

/**
 * The three FAQ sheets behind /profile/backup. They live here rather than in
 * the page so the page composes views instead of respelling their markup, and
 * so each sheet is a named surface the shot harness can find.
 */
export const BackupFaqModals = ({ active, onClose, platform }: BackupFaqModalsProps) => {
    const t = useTranslations('profile.backup')
    const tCommon = useTranslations('common')

    const closeCta = [{ text: tCommon('close'), shadowSize: '4' as const, onClick: onClose }]

    return (
        <>
            <ActionModal
                visible={active === 'lose-phone'}
                onClose={onClose}
                icon="info"
                title={t('faq.losePhone')}
                titleClassName="text-heading-xs"
                ctas={closeCta}
                content={
                    <div className="space-y-3 w-full">
                        {/* The heading rides in `children`, not the `title` prop: the
                            prop's semibold body step is the wrong weight for a
                            mini-header, and text-current keeps it on the tint. */}
                        <Notification priority="success">
                            <MiniHeader className="text-current">{t('losePhoneModal.enabledTitle')}</MiniHeader>
                            <p className="mt-1">{t('losePhoneModal.enabledDescription', { platform })}</p>
                        </Notification>
                        <Notification priority="error">
                            <MiniHeader className="text-current">{t('losePhoneModal.noBackupTitle')}</MiniHeader>
                            <p className="mt-1">{t('losePhoneModal.noBackupDescription')}</p>
                        </Notification>
                    </div>
                }
            />

            <ActionModal
                visible={active === 'change-phone'}
                onClose={onClose}
                icon="info"
                title={t('faq.changePhone')}
                titleClassName="text-heading-xs"
                ctas={closeCta}
                content={
                    <div className="space-y-4 w-full text-left">
                        <NumberedList
                            items={[
                                t('changePhoneModal.step1'),
                                t('changePhoneModal.step2', { platform }),
                                t('changePhoneModal.step3'),
                            ]}
                        />
                        {/* Three outcomes, not three warnings: the platform pairs are
                            the ordinary case, so they read as prose under mini-headers
                            rather than as a stack of tinted banners. */}
                        <div className="space-y-3">
                            <TextSection
                                title={t('changePhoneModal.iphoneToIphoneTitle')}
                                body={t('changePhoneModal.iphoneToIphoneDescription')}
                            />
                            <TextSection
                                title={t('changePhoneModal.androidToAndroidTitle')}
                                body={t('changePhoneModal.androidToAndroidDescription')}
                            />
                            <TextSection
                                title={t('changePhoneModal.crossPlatformTitle')}
                                body={t('changePhoneModal.crossPlatformDescription')}
                            />
                        </div>
                    </div>
                }
            />

            <ActionModal
                visible={active === 'export-keys'}
                onClose={onClose}
                icon="info"
                title={t('faq.exportKeys')}
                titleClassName="text-heading-xs"
                ctas={closeCta}
                content={
                    <div className="space-y-4 w-full text-left">
                        <div>
                            <MiniHeader>{t('exportKeysModal.saferTitle')}</MiniHeader>
                            <p className="mt-1 text-body-s text-foreground-primary">
                                {t('exportKeysModal.saferIntro')}
                            </p>
                            <ul className="space-y-1 mt-2 list-disc pl-6 text-body-s text-foreground-primary marker:text-action-primary">
                                <li>{t('exportKeysModal.bullets.screenshot')}</li>
                                <li>{t('exportKeysModal.bullets.textMessage')}</li>
                                <li>{t('exportKeysModal.bullets.noteApp')}</li>
                                <li>{t('exportKeysModal.bullets.malware')}</li>
                            </ul>
                        </div>
                        <TextSection
                            title={t('exportKeysModal.tradeoffTitle')}
                            body={t('exportKeysModal.tradeoffDescription')}
                        />
                        <div className="flex items-start gap-2 text-body-xs text-foreground-secondary">
                            <span className="mt-0.5 flex size-4 flex-shrink-0 items-center justify-center rounded-full border border-border-subtle">
                                i
                            </span>
                            <p>{t('exportKeysModal.futureNote')}</p>
                        </div>
                    </div>
                }
            />
        </>
    )
}

const TextSection = ({ title, body }: { title: string; body: string }) => (
    <div>
        <MiniHeader>{title}</MiniHeader>
        <p className="mt-1 text-body-s text-foreground-primary">{body}</p>
    </div>
)
