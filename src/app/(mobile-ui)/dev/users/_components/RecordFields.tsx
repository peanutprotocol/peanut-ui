import type { RecordRow } from '../userRecords.types'
import RecordValue from './RecordValue'

/** Every column of one row as label / value pairs. */
export default function RecordFields({ columns, row }: { columns: string[]; row: RecordRow }) {
    return (
        <dl className="grid grid-cols-[minmax(8rem,max-content)_1fr] text-body-s">
            {columns.map((column) => (
                <div key={column} className="contents">
                    <dt className="border-b border-border-default px-4 py-2 font-mono text-body-xs text-foreground-secondary">
                        {column}
                    </dt>
                    <dd className="min-w-0 border-b border-border-default px-4 py-2">
                        <RecordValue value={row[column]} full />
                    </dd>
                </div>
            ))}
        </dl>
    )
}
