'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { NumberedList } from '@/components/0_Bruddle/NumberedList'
import { Section } from '@/components/0_Bruddle/Section'
import Card from '@/components/Global/Card'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Notification } from '@/components/0_Bruddle/Notification'
import NavHeader from '@/components/Global/NavHeader'
import { BackupFaqModals, type BackupFaq } from '@/components/Profile/BackupFaqModals'
import { BackupStep } from '@/components/Profile/BackupStep'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useSafeBack } from '@/hooks/useSafeBack'

export default function BackupPage() {
    const t = useTranslations('profile.backup')
    const onBack = useSafeBack('/profile', { replace: true })
    const { deviceType } = useDeviceType()
    const [activeModal, setActiveModal] = useState<BackupFaq>(null)

    const isAndroid = deviceType === 'android'
    const platform = isAndroid ? 'android' : 'ios'
    const stepKeys = ['step1', 'step2', 'step3'] as const

    const backupSteps = stepKeys.map((step) => (
        <BackupStep
            key={step}
            title={t(`steps.${platform}.${step}.title`)}
            description={t(`steps.${platform}.${step}.description`)}
        />
    ))

    const closeModal = () => setActiveModal(null)

    return (
        <PageContainer>
            <div className="space-y-4 mb-6">
                <NavHeader title={t('title')} onPrev={onBack} />

                <EmptyState
                    title={t('nonCustodial.title')}
                    description={t('nonCustodial.description')}
                    icon="wallet"
                    iconColor="brand"
                />

                <Section title={t('enableNow')}>
                    <Card>
                        <NumberedList className="py-2" items={backupSteps} />
                    </Card>
                    <Notification priority="attention" title={t('noBackupWarning.title')}>
                        {t('noBackupWarning.description')}
                    </Notification>
                    {/* Passkeys saved to a third-party manager back up through
                        that manager, not the platform steps above. */}
                    <Notification priority="info">{t('thirdPartyNote')}</Notification>
                </Section>

                <Section title={t('faqHeading')}>
                    <ListGroup>
                        <ListItem title={t('faq.losePhone')} chevron onClick={() => setActiveModal('lose-phone')} />
                        <ListItem title={t('faq.changePhone')} chevron onClick={() => setActiveModal('change-phone')} />
                        <ListItem title={t('faq.exportKeys')} chevron onClick={() => setActiveModal('export-keys')} />
                    </ListGroup>
                </Section>
            </div>

            <BackupFaqModals active={activeModal} onClose={closeModal} platform={platform} />
        </PageContainer>
    )
}
