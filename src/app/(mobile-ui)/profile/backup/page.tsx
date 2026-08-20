'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import ActionModal from '@/components/Global/ActionModal'
import Card from '@/components/Global/Card'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Notification } from '@/components/0_Bruddle/Notification'
import NavHeader from '@/components/Global/NavHeader'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useSafeBack } from '@/hooks/useSafeBack'

type FaqModal = 'lose-phone' | 'change-phone' | 'export-keys' | null

export default function BackupPage() {
    const t = useTranslations('profile.backup')
    const onBack = useSafeBack('/profile', { replace: true })
    const { deviceType } = useDeviceType()
    const [activeModal, setActiveModal] = useState<FaqModal>(null)

    const isAndroid = deviceType === 'android'
    const platform = isAndroid ? 'android' : 'ios'

    const backupSteps = isAndroid
        ? [
              { title: t('steps.android.step1.title'), description: t('steps.android.step1.description') },
              { title: t('steps.android.step2.title'), description: t('steps.android.step2.description') },
              { title: t('steps.android.step3.title'), description: t('steps.android.step3.description') },
          ]
        : [
              { title: t('steps.ios.step1.title'), description: t('steps.ios.step1.description') },
              { title: t('steps.ios.step2.title'), description: t('steps.ios.step2.description') },
              { title: t('steps.ios.step3.title'), description: t('steps.ios.step3.description') },
          ]

    const closeModal = () => setActiveModal(null)

    return (
        <PageContainer>
            <div className="space-y-4 mb-6">
                <NavHeader title={t('title')} onPrev={onBack} />

                <EmptyState
                    title={t('nonCustodial.title')}
                    description={t('nonCustodial.description')}
                    icon="upload-cloud"
                />

                <div className="space-y-2">
                    <h1 className="text-heading-card text-foreground-primary">{t('enableNow')}</h1>
                    <Card>
                        <ol className="space-y-4 list-decimal py-2 pl-5">
                            {backupSteps.map((step, index) => (
                                <li key={index}>
                                    <p className="font-bold text-foreground-primary">{step.title}</p>
                                    <p className="text-body-s text-foreground-primary">{step.description}</p>
                                </li>
                            ))}
                        </ol>
                    </Card>
                    <Notification priority="attention" title={t('noBackupWarning.title')}>
                        {t('noBackupWarning.description')}
                    </Notification>
                </div>

                <div>
                    <h1 className="mb-2 text-heading-card text-foreground-primary">{t('faqHeading')}</h1>
                    <ListItem
                        position="first"
                        title={t('faq.losePhone')}
                        chevron
                        onClick={() => setActiveModal('lose-phone')}
                    />
                    <ListItem
                        position="middle"
                        title={t('faq.changePhone')}
                        chevron
                        onClick={() => setActiveModal('change-phone')}
                    />
                    <ListItem
                        position="last"
                        title={t('faq.exportKeys')}
                        chevron
                        onClick={() => setActiveModal('export-keys')}
                    />
                </div>
            </div>

            {/* FAQ Modal: What if I lose my phone? */}
            <ActionModal
                visible={activeModal === 'lose-phone'}
                onClose={closeModal}
                icon="info"
                title={t('faq.losePhone')}
                titleClassName="text-heading-xs"
                content={
                    <div className="space-y-3 w-full">
                        <Notification priority="success" title={t('losePhoneModal.enabledTitle')}>
                            {t('losePhoneModal.enabledDescription', { platform })}
                        </Notification>
                        <Notification priority="error" title={t('losePhoneModal.noBackupTitle')}>
                            {t('losePhoneModal.noBackupDescription')}
                        </Notification>
                    </div>
                }
            />

            {/* FAQ Modal: What if I change phone? */}
            <ActionModal
                visible={activeModal === 'change-phone'}
                onClose={closeModal}
                icon="info"
                title={t('faq.changePhone')}
                titleClassName="text-heading-xs"
                content={
                    <div className="space-y-3 w-full">
                        <ol className="list-decimal pl-5 text-left text-body-s text-foreground-primary">
                            <li>{t('changePhoneModal.step1')}</li>
                            <li>{t('changePhoneModal.step2', { platform })}</li>
                            <li>{t('changePhoneModal.step3')}</li>
                        </ol>
                        <Notification priority="success" title={t('changePhoneModal.iphoneToIphoneTitle')}>
                            {t('changePhoneModal.iphoneToIphoneDescription')}
                        </Notification>
                        <Notification priority="success" title={t('changePhoneModal.androidToAndroidTitle')}>
                            {t('changePhoneModal.androidToAndroidDescription')}
                        </Notification>
                        <Notification priority="attention" title={t('changePhoneModal.crossPlatformTitle')}>
                            {t('changePhoneModal.crossPlatformDescription')}
                        </Notification>
                    </div>
                }
            />

            {/* FAQ Modal: Why can't I export my private key? */}
            <ActionModal
                visible={activeModal === 'export-keys'}
                onClose={closeModal}
                icon="info"
                title={t('faq.exportKeys')}
                titleClassName="text-heading-xs"
                content={
                    <div className="space-y-4 w-full text-left">
                        <div>
                            <h4 className="font-bold text-foreground-primary">{t('exportKeysModal.saferTitle')}</h4>
                            <p className="mt-1 text-body-s text-foreground-primary">
                                {t('exportKeysModal.saferIntro')}
                            </p>
                            <ul className="space-y-1 mt-2 list-disc pl-5 text-body-s text-foreground-primary">
                                <li>{t('exportKeysModal.bullets.screenshot')}</li>
                                <li>{t('exportKeysModal.bullets.textMessage')}</li>
                                <li>{t('exportKeysModal.bullets.noteApp')}</li>
                                <li>{t('exportKeysModal.bullets.malware')}</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-foreground-primary">{t('exportKeysModal.tradeoffTitle')}</h4>
                            <p className="mt-1 text-body-s text-foreground-primary">
                                {t('exportKeysModal.tradeoffDescription')}
                            </p>
                        </div>
                        <div className="flex items-start gap-2 text-body-xs text-foreground-secondary">
                            <span className="mt-0.5 flex size-4 flex-shrink-0 items-center justify-center rounded-full border border-border-subtle">
                                i
                            </span>
                            <p>{t('exportKeysModal.futureNote')}</p>
                        </div>
                    </div>
                }
            />
        </PageContainer>
    )
}
