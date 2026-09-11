'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { MiniHeader } from '@/components/0_Bruddle/MiniHeader'
import { Notification } from '@/components/0_Bruddle/Notification'
import { NumberedList } from '@/components/0_Bruddle/NumberedList'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'

export type BackupFaq = 'lose-phone' | 'change-phone' | 'export-keys' | null

interface BackupFaqDrawersProps {
    active: BackupFaq
    onClose: () => void
    /** 'android' | 'ios' — the platform name the copy interpolates. */
    platform: string
}

/** The shared shell for the three FAQ sheets: pink info bubble, centered head,
 *  left-aligned help body, Close CTA. */
const FaqDrawer = ({
    open,
    onClose,
    title,
    closeLabel,
    children,
}: {
    open: boolean
    onClose: () => void
    title: string
    closeLabel: string
    children: React.ReactNode
}) => (
    <Drawer
        open={open}
        onOpenChange={(isOpen) => {
            if (!isOpen) onClose()
        }}
    >
        <DrawerContent>
            <div className="flex flex-col items-center pt-1 pb-6 text-center">
                {/* the head owns the M/12 beneath it; everything after it
                    keeps the drawer's L/16 rhythm */}
                <div className="mb-3 flex w-full flex-col items-center gap-4">
                    <IconBubble icon="info" className="bg-action-primary" />
                    <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                        <DrawerTitle>{title}</DrawerTitle>
                    </DrawerHeader>
                </div>
                <div className="flex w-full flex-col gap-4 text-left">
                    {children}
                    <Button shadowSize="4" className="w-full justify-center" onClick={onClose}>
                        {closeLabel}
                    </Button>
                </div>
            </div>
        </DrawerContent>
    </Drawer>
)

/**
 * The three FAQ sheets behind /profile/backup. They live here rather than in
 * the page so the page composes views instead of respelling their markup, and
 * so each sheet is a named surface the shot harness can find.
 */
export const BackupFaqDrawers = ({ active, onClose, platform }: BackupFaqDrawersProps) => {
    const t = useTranslations('profile.backup')
    const tCommon = useTranslations('common')
    const closeLabel = tCommon('close')

    return (
        <>
            <FaqDrawer
                open={active === 'lose-phone'}
                onClose={onClose}
                title={t('faq.losePhone')}
                closeLabel={closeLabel}
            >
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
            </FaqDrawer>

            <FaqDrawer
                open={active === 'change-phone'}
                onClose={onClose}
                title={t('faq.changePhone')}
                closeLabel={closeLabel}
            >
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
            </FaqDrawer>

            <FaqDrawer
                open={active === 'export-keys'}
                onClose={onClose}
                title={t('faq.exportKeys')}
                closeLabel={closeLabel}
            >
                <div className="space-y-4 w-full text-left">
                    <div>
                        <MiniHeader>{t('exportKeysModal.saferTitle')}</MiniHeader>
                        <p className="mt-1 text-body-s text-foreground-primary">{t('exportKeysModal.saferIntro')}</p>
                        <BulletList
                            size="s"
                            className="mt-2"
                            items={[
                                t('exportKeysModal.bullets.screenshot'),
                                t('exportKeysModal.bullets.textMessage'),
                                t('exportKeysModal.bullets.noteApp'),
                                t('exportKeysModal.bullets.malware'),
                            ]}
                        />
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
            </FaqDrawer>
        </>
    )
}

const TextSection = ({ title, body }: { title: string; body: string }) => (
    <div>
        <MiniHeader>{title}</MiniHeader>
        <p className="mt-1 text-body-s text-foreground-primary">{body}</p>
    </div>
)
