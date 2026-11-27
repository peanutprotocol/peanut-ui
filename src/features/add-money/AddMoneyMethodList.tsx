'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { useAddMoneyReadiness } from './useAddMoneyReadiness'
import type { AddMoneyPickerMethod } from './addMoneyMethods'
import { addMoneyMethodHref, useAddMoneyMethodRows } from './useAddMoneyMethodRows'
import { useRouter } from 'next/navigation'

/**
 * The Add picker's rows, in the order the methods resolve: ARS leads for a resident of Argentina, and Pix
 * where the route offers it on Avenia. The card's funding step shows the same rows, so a user who needs a
 * balance there gets the same ways in (TASK-25444).
 */
export function AddMoneyMethodList({
    returnTo,
    bankReturnTo = returnTo,
    onSelect,
}: {
    /** where the deposit a row opens goes back to */
    returnTo: string
    /** the bank hub's own origin; the picker passes its origin, because the hub shares the picker's path */
    bankReturnTo?: string | null
    onSelect?: (method: AddMoneyPickerMethod) => void
}) {
    const router = useRouter()
    const rowFor = useAddMoneyMethodRows()
    const { pickerMethods, isLoading, residenceIso2s } = useAddMoneyReadiness(false)
    // Hold the rows until the methods resolve: ARS or Pix would otherwise appear above a row the user may
    // already be tapping (Aleks, 26 Nov, TASK-25444)
    if (isLoading) {
        // as many placeholders as rows to come (design.md, skeletons): ARS needs a residence in Argentina and
        // Pix mostly goes to residents of Brazil, so they get three rows and anybody else two
        const placeholders = residenceIso2s.some((iso2) => iso2 === 'AR' || iso2 === 'BR') ? 3 : 2
        return (
            <ListGroup aria-busy data-testid="add-money-methods-loading">
                {Array.from({ length: placeholders }, (_, index) => (
                    <ListItem
                        key={index}
                        leading={<div className="size-8 animate-pulse rounded-full bg-background-skeleton" />}
                        title={<div className="h-4 w-32 animate-pulse rounded bg-background-skeleton" />}
                        body={<div className="h-4 w-48 animate-pulse rounded bg-background-skeleton" />}
                        chevron
                    />
                ))}
            </ListGroup>
        )
    }
    return (
        <ListGroup>
            {pickerMethods.map((key) => {
                const row = rowFor[key]
                return (
                    <ListItem
                        key={key}
                        title={row.title}
                        body={row.description}
                        bodyWrap
                        leading={row.icon}
                        chevron
                        data-testid={`add-money-method-${key}`}
                        onClick={() => {
                            onSelect?.(key)
                            router.push(addMoneyMethodHref(key, returnTo, bankReturnTo ?? null))
                        }}
                    />
                )
            })}
        </ListGroup>
    )
}
