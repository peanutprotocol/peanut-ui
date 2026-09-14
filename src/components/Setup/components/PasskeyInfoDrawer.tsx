'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import DocsLink from '@/components/Global/DocsLink'
import { useTranslations } from 'next-intl'

/**
 * In-app passkey explainer for the setup flow. Mid-signup, ejecting the user
 * into a browser tab (the old DocsLink behavior) risks losing them right
 * before the passkey ceremony — the short answer lives here, and the full
 * help-center guide stays one tap away for those who want it.
 */
const PasskeyInfoDrawer = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    const t = useTranslations('setup.passkey.info')
    const tCommon = useTranslations('common')

    return (
        <Drawer
            open={visible}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after it
                        keeps the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon="lock" className="bg-action-primary" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('title')}</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col gap-4">
                        <div className="flex flex-col gap-3 text-left text-body-s text-foreground-primary">
                            <p>{t('what')}</p>
                            <p>{t('backup')}</p>
                            <p>{t('privacy')}</p>
                            <p className="text-body-xs text-foreground-secondary">
                                <DocsLink href="/en/help/passkeys" className="underline underline-offset-2">
                                    {t('fullGuide')}
                                </DocsLink>
                            </p>
                        </div>
                        <Button variant="purple" shadowSize="4" className="w-full justify-center" onClick={onClose}>
                            {tCommon('gotIt')}
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default PasskeyInfoDrawer
