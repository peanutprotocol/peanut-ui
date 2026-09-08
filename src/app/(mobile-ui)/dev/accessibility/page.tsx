'use client'

import { useState } from 'react'
import { AccessibilityView } from '@/components/Settings/AccessibilityView'
import { Button } from '@/components/0_Bruddle/Button'
import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import { HoldToClaimButton } from '@/components/Global/HoldToClaimButton'
import { Notification } from '@/components/0_Bruddle/Notification'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import BaseInput from '@/components/0_Bruddle/BaseInput'

/** Local/preview fixture: real shared controls, no API or money movement. */
export default function AccessibilityPreview() {
    const [drawer, setDrawer] = useState(false)
    const [completed, setCompleted] = useState(0)
    const [rowAction, setRowAction] = useState('No row action yet')
    return (
        <main className="mx-auto space-y-8 w-full max-w-md p-4">
            <AccessibilityView />
            <section className="space-y-4" aria-label="Accessibility regression controls">
                <h2 className="text-heading-xs">Confirmation preview</h2>
                <Notification priority="info">These controls are a local preview. They do not send money.</Notification>
                <label htmlFor="preview-amount" className="block text-body-m">
                    Amount
                </label>
                <BaseInput id="preview-amount" defaultValue="25.00" inputMode="decimal" />
                <SlideToConfirm
                    label="Slide to confirm preview"
                    confirmLabel="Confirm preview"
                    onConfirm={() => setCompleted((n) => n + 1)}
                />
                <HoldToClaimButton onComplete={() => setCompleted((n) => n + 1)}>Open preview reward</HoldToClaimButton>
                <p role="status" aria-atomic="true" className="text-body-m">
                    Confirmed {completed} times
                </p>
                <div className="flex flex-wrap gap-2">
                    <StatusBadge status="completed" />
                    <StatusBadge status="pending" />
                    <StatusBadge status="failed" />
                </div>
                <ListItem
                    interactiveContent
                    title={
                        <button type="button" onClick={() => setRowAction('Profile selected')}>
                            Sample profile
                        </button>
                    }
                    body="Transaction details"
                    trailing="$25"
                    onClick={() => setRowAction('Transaction details selected')}
                />
                <p role="status" className="text-body-m">
                    {rowAction}
                </p>
                <Button variant="stroke" onClick={() => setDrawer(true)}>
                    Open preview drawer
                </Button>
                <Drawer open={drawer} onOpenChange={setDrawer}>
                    <DrawerContent scrollAreaClassName="px-6">
                        <div className="flex flex-col gap-4 pb-6">
                            <DrawerTitle>Payment details preview</DrawerTitle>
                            <p className="text-body-m">
                                Review the amount and recipient before confirming your payment.
                            </p>
                            <DrawerClose asChild>
                                <Button variant="stroke">Close preview drawer</Button>
                            </DrawerClose>
                        </div>
                    </DrawerContent>
                </Drawer>
            </section>
        </main>
    )
}
