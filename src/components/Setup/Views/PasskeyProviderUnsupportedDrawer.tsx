'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { NumberedList } from '@/components/0_Bruddle/NumberedList'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useTranslations } from 'next-intl'

interface PasskeyProviderUnsupportedDrawerProps {
    visible: boolean
    onClose: () => void
    onRetry: () => void
    onSignUpInBrowser: () => void
    onSupport?: () => void
}

/**
 * Opens when signup refuses a passkey whose password manager writes the signed
 * note in a layout the wallet validator cannot read (PASSKEY_PROVIDER_UNSUPPORTED,
 * TASK-24498): the phone's own manager on some Xiaomi, vivo, OPPO, realme and
 * OnePlus phones. Two ways out: make Google Password Manager the preferred
 * service and retry, or sign up in Chrome, where the browser writes the note.
 */
export const PasskeyProviderUnsupportedDrawer = ({
    visible,
    onClose,
    onRetry,
    onSignUpInBrowser,
    onSupport,
}: PasskeyProviderUnsupportedDrawerProps) => {
    const t = useTranslations('setup.passkeyProvider')
    const tHelp = useTranslations('setup.passkey.help')
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
                    {/* same anatomy as LoginRecoveryDrawer: the head owns the M/12 beneath it */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon="alert" color="yellow" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('title')}</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col gap-4 text-left">
                        <NumberedList items={[t('steps.openSettings'), t('steps.chooseGoogle')]} />
                        <div className="flex w-full flex-col items-center gap-4">
                            <Button icon="retry" onClick={onRetry} className="w-full justify-center">
                                {tCommon('retry')}
                            </Button>
                            <Button variant="secondary" onClick={onSignUpInBrowser} className="w-full justify-center">
                                {t('signUpInChrome')}
                            </Button>
                            {/* XL/24 above the tertiary link: its hit area reaches 14px up, the button shadow 4px down */}
                            <div className="mt-2">
                                <LinkButton href="https://peanut.me/support" onClick={onSupport}>
                                    {tHelp('stillHavingIssues')}
                                </LinkButton>
                            </div>
                        </div>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
