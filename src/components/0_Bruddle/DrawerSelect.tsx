'use client'

import { useState } from 'react'
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/Global/Drawer'
import { SelectList } from './SelectList'
import { type SelectOption } from './SelectList.types'

interface DrawerSelectProps<T extends string> {
    /** The drawer heading. */
    title: string
    /** The control that opens the drawer, usually a Button with a chevron-down. */
    trigger: React.ReactElement
    options: SelectOption<T>[]
    /** The chosen value; null when nothing is chosen yet. */
    value: T | null
    /** The drawer closes after this resolves, so an async choice (a locale) lands first. */
    onChange: (value: T) => void | Promise<void>
}

/**
 * A select whose options open in a bottom drawer instead of a dropdown list
 * (code-only, TASK-23678: sign-up built this twice, for the "Choose" pickers and
 * the language picker). The caller owns the trigger, so it can be a compact
 * inline Button inside a sentence or a ghost Button in a header. The rows are a
 * SelectList, so the chosen row follows the selected-row rule.
 */
export function DrawerSelect<T extends string>({ title, trigger, options, value, onChange }: DrawerSelectProps<T>) {
    const [open, setOpen] = useState(false)
    const choose = async (next: T) => {
        await onChange(next)
        setOpen(false)
    }
    return (
        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
            <DrawerTrigger asChild>{trigger}</DrawerTrigger>
            <DrawerContent>
                <div className="flex flex-col gap-4 pb-4">
                    <DrawerTitle>{title}</DrawerTitle>
                    <SelectList options={options} value={value} onSelect={(next) => void choose(next)} />
                </div>
            </DrawerContent>
        </Drawer>
    )
}
