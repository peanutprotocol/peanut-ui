interface PropsTableRow {
    name: string
    type: string
    default: string
    required?: boolean
    description?: string
}

export function PropsTable({ rows }: { rows: PropsTableRow[] }) {
    return (
        <div className="overflow-x-auto rounded-sm border border-border-disabled text-body-s">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-border-disabled bg-background-disabled">
                        <th className="px-4 py-2 text-left text-label-m text-foreground-secondary uppercase">prop</th>
                        <th className="px-4 py-2 text-left text-label-m text-foreground-secondary uppercase">type</th>
                        <th className="px-4 py-2 text-left text-label-m text-foreground-secondary uppercase">
                            default
                        </th>
                        <th className="hidden px-4 py-2 text-left text-label-m text-foreground-secondary uppercase sm:table-cell">
                            description
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.name} className="border-b border-border-disabled last:border-0">
                            <td className="px-4 py-2 font-mono font-bold">
                                {row.name}
                                {row.required && <span className="ml-1 text-foreground-error">*</span>}
                            </td>
                            <td className="px-4 py-2 font-mono text-foreground-secondary">{row.type}</td>
                            <td className="px-4 py-2 font-mono text-foreground-secondary">{row.default}</td>
                            {row.description && (
                                <td className="hidden px-4 py-2 text-foreground-secondary sm:table-cell">
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
