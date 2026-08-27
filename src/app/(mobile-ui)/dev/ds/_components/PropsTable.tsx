interface PropsTableRow {
    name: string
    type: string
    default: string
    required?: boolean
    description?: string
}

export function PropsTable({ rows }: { rows: PropsTableRow[] }) {
    return (
        <div className="overflow-x-auto rounded-sm border border-gray-3 text-body-s">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-gray-3 bg-gray-3/40">
                        <th className="px-4 py-2.5 text-left text-body-xs font-bold tracking-wider text-gray-1 uppercase">
                            prop
                        </th>
                        <th className="px-4 py-2.5 text-left text-body-xs font-bold tracking-wider text-gray-1 uppercase">
                            type
                        </th>
                        <th className="px-4 py-2.5 text-left text-body-xs font-bold tracking-wider text-gray-1 uppercase">
                            default
                        </th>
                        <th className="hidden px-4 py-2.5 text-left text-body-xs font-bold tracking-wider text-gray-1 uppercase sm:table-cell">
                            description
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.name} className="border-b border-gray-3 last:border-0">
                            <td className="px-4 py-2.5 font-mono font-bold">
                                {row.name}
                                {row.required && <span className="ml-1 text-error-1">*</span>}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-foreground-secondary">{row.type}</td>
                            <td className="px-4 py-2.5 font-mono text-foreground-secondary">{row.default}</td>
                            {row.description && (
                                <td className="hidden px-4 py-2.5 text-foreground-secondary sm:table-cell">
                                    {row.description}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
