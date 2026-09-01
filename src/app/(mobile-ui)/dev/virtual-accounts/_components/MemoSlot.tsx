'use client'

import { Card } from '@/components/0_Bruddle/Card'
import { Notification } from '@/components/0_Bruddle/Notification'
import CopyField from '@/components/Global/CopyField'

/**
 * The payment reference — the one block a Bridge V1 user must not miss.
 *
 * This is the removable slot of the memo fork: when the Virtual Accounts SKU
 * is enabled the caller passes `memo={null}` and the slot renders nothing.
 * Deleting this file and its two call sites is the whole SKU migration on the
 * details screen — no other block changes shape.
 *
 * Precedents: AddMoneyBankDetails "deposit reference" card (label + value +
 * Notification attention inside a Card p-4); CopyField for a value the user
 * must copy whole (components.md: "read-only value with a copy button").
 */
export function MemoSlot({ memo }: { memo: string | null }) {
    if (!memo) return null
    return (
        <Card className="flex flex-col gap-4 p-4" data-testid="va-memo-slot">
            <div className="flex flex-col gap-1">
                <span className="text-body-xs text-foreground-secondary">Payment reference · required</span>
                <CopyField text={memo} variant="purple" />
            </div>
            <Notification priority="attention">
                The payer must put this in the reference or memo field. Without it the money goes back to them.
            </Notification>
        </Card>
    )
}
