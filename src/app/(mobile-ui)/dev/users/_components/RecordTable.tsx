'use client'

import { useState } from 'react'
import { twMerge } from '@/utils/tw'
import type { RecordSection } from '../userRecords.types'
import { tableColumns } from '../userRecords.utils'
import RecordFields from './RecordFields'
import RecordValue from './RecordValue'

/**
 * All rows of one table. Click a row to read every field in full below the
 * table: inside the horizontally scrolling table the fields would be cut off.
 */
export default function RecordTable({ section }: { section: RecordSection }) {
    const [open, setOpen] = useState<number | null>(null)
    const columns = tableColumns(section.columns)
    const toggle = (index: number) => setOpen(open === index ? null : index)

    return (
        <>
            <div className="max-h-[36rem] overflow-auto">
                <table className="w-max min-w-full border-collapse text-body-xs">
                    <thead>
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column}
                                    scope="col"
                                    className="sticky top-0 border-b border-border-default bg-background-default px-3 py-2 text-left font-mono font-normal whitespace-nowrap text-foreground-secondary"
                                >
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {section.rows.map((row, index) => (
                            <tr
                                key={index}
                                tabIndex={0}
                                aria-expanded={open === index}
                                title="Show all fields"
                                className={twMerge(
                                    'cursor-pointer hover:bg-background-badge-accent/30 focus-visible:outline-[3px] focus-visible:-outline-offset-[3px] focus-visible:outline-action-focus',
                                    open === index && 'bg-background-selection'
                                )}
                                onClick={() => toggle(index)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        toggle(index)
                                    }
                                }}
                            >
                                {columns.map((column) => (
                                    <td
                                        key={column}
                                        className="max-w-64 truncate border-b border-border-default px-3 py-2 align-top whitespace-nowrap [&_*]:break-normal"
                                    >
                                        <RecordValue value={row[column]} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {open !== null && section.rows[open] && (
                <div className="border-t border-border-default">
                    <p className="px-4 pt-3 pb-1 text-body-xs text-foreground-secondary">Row {open + 1}, all fields</p>
                    <RecordFields columns={section.columns} row={section.rows[open]} />
                </div>
            )}
        </>
    )
}
