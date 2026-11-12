'use client'

import type { ComponentProps } from 'react'
import AmountInput from '@/components/Global/AmountInput'
import { FieldError } from '@/components/0_Bruddle/FieldError'

/**
 * The amount of a payment form: the local currency over USD, with the swap
 * between them, and the one error line under it (balance, minimum). The same
 * card for the Pix-key payment and the Pix withdrawal.
 */
export function AmountCard({ error, ...input }: ComponentProps<typeof AmountInput> & { error?: string }) {
    return (
        <div className="flex flex-col gap-1">
            <AmountInput {...input} />
            {error && <FieldError data-testid="error-alert">{error}</FieldError>}
        </div>
    )
}
