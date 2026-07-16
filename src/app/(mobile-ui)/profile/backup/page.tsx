'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import ActionModal from '@/components/Global/ActionModal'
import Card from '@/components/Global/Card'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import InfoCard from '@/components/Global/InfoCard'
import NavHeader from '@/components/Global/NavHeader'
import NavigationArrow from '@/components/Global/NavigationArrow'
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
            <div className="mb-6 space-y-4">
                <NavHeader title={t('title')} onPrev={onBack} />

                <EmptyState
                    title={t('nonCustodial.title')}
                    description={t('nonCustodial.description')}
                    icon="upload-cloud"
                />

                <div className="space-y-2">
                    <h1 className="font-bold text-black">{t('enableNow')}</h1>
                    <Card>
                        <ol className="list-decimal space-y-4 py-2 pl-5">
                            {backupSteps.map((step, index) => (
                                <li key={index}>
                                    <p className="font-bold text-black">{step.title}</p>
                                    <p className="text-sm text-black">{step.description}</p>
                                </li>
                            ))}
                        </ol>
                    </Card>
                    <InfoCard
                        variant="warning"
                        title={t('noBackupWarning.title')}
                        description={t('noBackupWarning.description')}
                        icon="alert"
                    />
                </div>

                <div>
                    <h1 className="mb-2 font-bold text-black">{t('faqHeading')}</h1>
                    <Card position="first" onClick={() => setActiveModal('lose-phone')}>
                        <div className="flex cursor-pointer justify-between py-1">
                            <p className="text-sm font-medium text-black">{t('faq.losePhone')}</p>
                            <NavigationArrow size={24} className="fill-black" />
                        </div>
                    </Card>
                    <Card position="middle" onClick={() => setActiveModal('change-phone')}>
                        <div className="flex cursor-pointer justify-between py-1">
                            <p className="text-sm font-medium text-black">{t('faq.changePhone')}</p>
                            <NavigationArrow size={24} className="fill-black" />
                        </div>
                    </Card>
                    <Card position="last" onClick={() => setActiveModal('export-keys')}>
                        <div className="flex cursor-pointer justify-between py-1">
                            <p className="text-sm font-medium text-black">{t('faq.exportKeys')}</p>
                            <NavigationArrow size={24} className="fill-black" />
                        </div>
                    </Card>
                </div>
            </div>

            {/* FAQ Modal: What if I lose my phone? */}
            <ActionModal
                visible={activeModal === 'lose-phone'}
                onClose={closeModal}
                icon="info"
                title={t('faq.losePhone')}
                titleClassName="font-extrabold text-xl"
                content={
                    <div className="w-full space-y-3">
                        <InfoCard
                            variant="success"
                            icon="check"
                            iconClassName="text-success"
                            title={t('losePhoneModal.enabledTitle')}
                            description={t('losePhoneModal.enabledDescription', { platform })}
                        />
                        <InfoCard
                            variant="error"
                            icon="cancel"
                            title={t('losePhoneModal.noBackupTitle')}
                            description={t('losePhoneModal.noBackupDescription')}
                        />
                    </div>
                }
            />

            {/* FAQ Modal: What if I change phone? */}
            <ActionModal
                visible={activeModal === 'change-phone'}
                onClose={closeModal}
                icon="info"
                title={t('faq.changePhone')}
                titleClassName="font-extrabold text-xl"
                content={
                    <div className="w-full space-y-3">
                        <ol className="list-decimal pl-5 text-left text-sm text-black">
                            <li>{t('changePhoneModal.step1')}</li>
                            <li>{t('changePhoneModal.step2', { platform })}</li>
                            <li>{t('changePhoneModal.step3')}</li>
                        </ol>
                        <InfoCard
                            variant="success"
                            icon="check"
                            iconClassName="text-success"
                            title={t('changePhoneModal.iphoneToIphoneTitle')}
                            description={t('changePhoneModal.iphoneToIphoneDescription')}
                        />
                        <InfoCard
                            variant="success"
                            icon="check"
                            iconClassName="text-success"
                            title={t('changePhoneModal.androidToAndroidTitle')}
                            description={t('changePhoneModal.androidToAndroidDescription')}
                        />
                        <InfoCard
                            variant="warning"
                            icon="alert"
                            title={t('changePhoneModal.crossPlatformTitle')}
                            description={t('changePhoneModal.crossPlatformDescription')}
                        />
                    </div>
                }
            />

            {/* FAQ Modal: Why can't I export my private key? */}
            <ActionModal
                visible={activeModal === 'export-keys'}
                onClose={closeModal}
                icon="info"
                title={t('faq.exportKeys')}
                titleClassName="font-extrabold text-xl"
                content={
                    <div className="w-full space-y-4 text-left">
                        <div>
                            <h4 className="font-bold text-black">{t('exportKeysModal.saferTitle')}</h4>
                            <p className="mt-1 text-sm text-black">{t('exportKeysModal.saferIntro')}</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-black">
                                <li>{t('exportKeysModal.bullets.screenshot')}</li>
                                <li>{t('exportKeysModal.bullets.textMessage')}</li>
                                <li>{t('exportKeysModal.bullets.noteApp')}</li>
                                <li>{t('exportKeysModal.bullets.malware')}</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-black">{t('exportKeysModal.tradeoffTitle')}</h4>
                            <p className="mt-1 text-sm text-black">{t('exportKeysModal.tradeoffDescription')}</p>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-gray-1">
                            <span className="mt-0.5 flex size-4 flex-shrink-0 items-center justify-center rounded-full border border-gray-1">
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
