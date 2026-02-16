interface PropsTableRow {
    name: string
    type: string
    default: string
    required?: boolean
    description?: string
}

export function PropsTable({ rows }: { rows: PropsTableRow[] }) {
    return (
        <div className="overflow-x-auto rounded-sm border border-gray-3 text-sm">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-gray-3 bg-gray-3/40">
                        <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-gray-1">
                            prop
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-gray-1">
                            type
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-gray-1">
                            default
                        </th>
                        <th className="hidden px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-gray-1 sm:table-cell">
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
                            <td className="px-4 py-2.5 font-mono text-grey-1">{row.type}</td>
                            <td className="px-4 py-2.5 font-mono text-grey-1">{row.default}</td>
                            {row.description && (
                                <td className="hidden px-4 py-2.5 text-grey-1 sm:table-cell">{row.description}</td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
