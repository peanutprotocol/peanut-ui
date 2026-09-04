'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { useTranslations } from 'next-intl'

interface CancelSendLinkDrawerProps {
    showCancelLinkDrawer: boolean
    setShowCancelLinkDrawer: (showCancelLinkDrawer: boolean) => void
    amount: string
    onClick: () => void | Promise<void>
    isLoading?: boolean
    /** True when opened from inside another drawer (the transaction details drawer). */
    nested?: boolean
}

const CancelSendLinkDrawer = ({
    showCancelLinkDrawer,
    setShowCancelLinkDrawer,
    amount,
    onClick,
    isLoading = false,
    nested = false,
}: CancelSendLinkDrawerProps) => {
    // Catalog path keeps its historical `cancelSendLinkModal` name — the copy is
    // unchanged and es-AR has no override, so renaming the key only risks the fallback.
    const t = useTranslations('global')

    return (
        <Drawer
            nested={nested}
            open={showCancelLinkDrawer}
            // The cancel is an on-chain claim-back: once it is in flight the user
            // cannot back out, so swipe-to-dismiss is off until it settles.
            dismissible={!isLoading}
            onOpenChange={(isOpen) => {
                if (!isOpen && !isLoading) setShowCancelLinkDrawer(false)
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center gap-4 px-4 pt-1 pb-6 text-center">
                    {/* destructive-confirm anatomy: red icon bubble (design.md nested-drawer recipe) */}
                    <IconBubble icon="link-slash" color="red" />

                    <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                        <DrawerTitle>{t('cancelSendLinkModal.title')}</DrawerTitle>
                        {/* two paragraphs under the head → body reads left-aligned, not centered */}
                        <DrawerDescription className="space-y-2 text-left">
                            <span className="block">
                                {t.rich('cancelSendLinkModal.amountReturned', {
                                    amount,
                                    strong: (chunks) => <strong>{chunks}</strong>,
                                })}
                            </span>
                            <span className="block">{t('cancelSendLinkModal.noLongerClaimable')}</span>
                        </DrawerDescription>
                    </DrawerHeader>

                    <Button
                        onClick={onClick}
                        loading={isLoading}
                        disabled={isLoading}
                        shadowSize="4"
                        className="w-full justify-center"
                    >
                        {t('cancelSendLinkModal.cancelCta')}
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default CancelSendLinkDrawer
