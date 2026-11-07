'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { NumberedList } from '@/components/0_Bruddle/NumberedList'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useTranslations } from 'next-intl'

interface LoginRecoveryDrawerProps {
    visible: boolean
    onClose: () => void
    onRetry: () => void
    /** Omitted where this surface does not offer signup (the web app-only layout). */
    onSignUp?: () => void
    onSupport?: () => void
    platform: 'android' | 'ios' | 'web'
}

/**
 * Opens after a login the OS could not finish with a Peanut passkey: Android's
 * "no credential" answer, or a repeated cancel on iOS and the web, where an
 * empty passkey list closes the sheet the same way a deliberate dismissal does.
 * The steps repeat the sync paths the account-recovery help article gives;
 * Peanut cannot restore a passkey itself.
 */
export const LoginRecoveryDrawer = ({
    visible,
    onClose,
    onRetry,
    onSignUp,
    onSupport,
    platform,
}: LoginRecoveryDrawerProps) => {
    const t = useTranslations('setup.loginRecovery')
    const tHelp = useTranslations('setup.passkey.help')
    const tCommon = useTranslations('common')
    const step = (id: 'sameAccount' | 'thatPhone') => t(`steps.${platform}.${id}` as Parameters<typeof t>[0])
    // On a phone the account sync comes first; in a browser the other phone does.
    const steps =
        platform === 'web' ? [step('thatPhone'), step('sameAccount')] : [step('sameAccount'), step('thatPhone')]

    return (
        <Drawer
            open={visible}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* same anatomy as PasskeySetupHelpDrawer: the head owns the M/12 beneath it */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon="alert" color="yellow" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('title')}</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col gap-4 text-left">
                        <NumberedList items={steps} />
                        <div className="flex w-full flex-col items-center gap-4">
                            <Button icon="retry" shadowSize="4" onClick={onRetry} className="w-full justify-center">
                                {tCommon('retry')}
                            </Button>
                            {onSignUp && (
                                <Button
                                    variant="secondary"
                                    shadowSize="4"
                                    onClick={onSignUp}
                                    className="w-full justify-center"
                                >
                                    {t('signUp')}
                                </Button>
                            )}
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
