'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LINK_BUTTON_CLASSES } from '@/components/0_Bruddle/LinkButton'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import { SetupDocLink } from '@/components/Setup/components/SetupDocsDrawer'
import { useSignupControl } from '@/features/setup/useSignupControl'

/**
 * "What's a passkey?" on 11 (state `what-passkey`): the anatomy and events of dev's `PasskeyInfoDrawer`, with the
 * redesign's copy (no "no password" clause). The full guide stays one tap away in the in-app docs drawer.
 */
export function PasskeyInfoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    const t = useTranslations('setupRedesign.final')
    const { track } = useSignupControl()
    return (
        <Drawer
            open={open}
            onOpenChange={(isOpen) => {
                if (isOpen) return
                track('passkey_info', 'dismiss')
                onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon="lock" color="blue" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('infoTitle')}</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col gap-4">
                        <div className="flex flex-col gap-3 text-left text-body-s leading-relaxed text-foreground-primary">
                            <p>{t('infoWhat')}</p>
                            <p>{t('infoBackup')}</p>
                            <p>{t('infoPrivacy')}</p>
                        </div>
                        <Button
                            variant="primary"
                            shadowSize="4"
                            className="w-full justify-center"
                            onClick={() => {
                                track('passkey_info_got_it', 'tap')
                                onClose()
                            }}
                        >
                            {t('gotIt')}
                        </Button>
                        <p className="text-center">
                            <SetupDocLink
                                kind="passkeys"
                                href="/en/help/passkeys"
                                className={LINK_BUTTON_CLASSES}
                                onBeforeOpen={onClose}
                            >
                                <Icon name="info" size={16} className="shrink-0" />
                                {t('fullGuide')}
                            </SetupDocLink>
                        </p>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
