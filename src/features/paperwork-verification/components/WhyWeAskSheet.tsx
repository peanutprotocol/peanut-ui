'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'

/**
 * A "Why do we ask?" link that opens a sheet of reasons and a "Got it" button. The verify questions and the sign-up
 * screens share it; each caller sends its own analytics through the callbacks.
 */
export function WhyWeAskSheet({
    link,
    title,
    reasons,
    testId,
    onOpen,
    onDismiss,
    onGotIt,
}: {
    link: string
    title: string
    reasons: readonly string[]
    testId: string
    onOpen: () => void
    onDismiss: () => void
    onGotIt: () => void
}) {
    const t = useTranslations('kyc.paperworkVerification')
    const [open, setOpen] = useState(false)
    return (
        <>
            <LinkButton
                onClick={() => {
                    onOpen()
                    setOpen(true)
                }}
                data-testid={testId}
            >
                {link}
            </LinkButton>
            <Drawer
                open={open}
                onOpenChange={(next) => {
                    if (!next) onDismiss()
                    setOpen(next)
                }}
            >
                <DrawerContent>
                    <div className="flex flex-col gap-4 pb-4">
                        <DrawerTitle>{title}</DrawerTitle>
                        {reasons.map((reason) => (
                            <p key={reason} className="text-body-s text-foreground-secondary">
                                {reason}
                            </p>
                        ))}
                        <Button
                            variant="secondary"
                            shadowSize="4"
                            onClick={() => {
                                onGotIt()
                                setOpen(false)
                            }}
                        >
                            {t('gotIt')}
                        </Button>
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    )
}
