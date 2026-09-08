'use client'

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from '@headlessui/react'
import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useBackHandler } from '@/hooks/useBackHandler'

function ConfirmationDialog({
    label,
    onCancel,
    onConfirm,
}: {
    label: ReactNode
    onCancel: () => void
    onConfirm: () => void
}) {
    const t = useTranslations('settings.accessibility')
    useBackHandler(() => {
        onCancel()
        return true
    }, true)
    return (
        <Dialog open onClose={onCancel} className="relative z-[100]">
            <DialogBackdrop className="fixed inset-0 bg-black/80" />
            <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                <DialogPanel className="w-full max-w-md rounded border border-border-default bg-background-default p-6">
                    <DialogTitle className="text-heading-xs">{label}</DialogTitle>
                    <Description className="mt-3 text-body-m text-foreground-secondary">
                        {t('confirmDescription')}
                    </Description>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <button
                            type="button"
                            data-autofocus
                            onClick={onCancel}
                            className="btn btn-stroke min-w-24 flex-1"
                        >
                            {t('cancel')}
                        </button>
                        <button type="button" onClick={onConfirm} className="btn btn-purple min-w-24 flex-1">
                            {t('confirm')}
                        </button>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    )
}

/** A separate, cancellable step for click, keyboard and assistive activation. */
export function useAccessibleConfirmation(label: ReactNode, onConfirm: () => void, disabled = false) {
    const [open, setOpen] = useState(false)
    const committed = useRef(false)
    useEffect(() => {
        if (disabled) setOpen(false)
    }, [disabled])
    return {
        requestConfirmation: () => {
            if (disabled) return
            committed.current = false
            setOpen(true)
        },
        confirmationDialog:
            open && !disabled ? (
                <ConfirmationDialog
                    label={label}
                    onCancel={() => setOpen(false)}
                    onConfirm={() => {
                        if (committed.current || disabled) return
                        committed.current = true
                        setOpen(false)
                        onConfirm()
                    }}
                />
            ) : null,
    }
}
