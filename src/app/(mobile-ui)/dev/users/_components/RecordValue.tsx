import { formatUtc, isIsoDate } from '../userRecords.utils'

const LONG_TEXT = 120

/** One stored value. `full` shows JSON and long text whole; otherwise it stays on one line. */
export default function RecordValue({ value, full = false }: { value: unknown; full?: boolean }) {
    if (value === null || value === undefined) return <span className="text-foreground-secondary italic">null</span>
    if (value === '[redacted]') return <span className="text-foreground-secondary">hidden (secret)</span>
    if (typeof value === 'boolean') return <span className="font-mono text-body-xs">{String(value)}</span>
    if (typeof value === 'number') return <span className="tabular-nums">{value}</span>
    if (typeof value === 'object') {
        return full ? (
            <pre className="max-h-96 overflow-auto font-mono text-body-xs break-all whitespace-pre-wrap">
                {JSON.stringify(value, null, 2)}
            </pre>
        ) : (
            <span className="font-mono text-body-xs">{JSON.stringify(value)}</span>
        )
    }
    const text = String(value)
    if (isIsoDate(text)) {
        return (
            <time dateTime={text} title={text}>
                {formatUtc(text)}
            </time>
        )
    }
    if (full && text.length > LONG_TEXT) {
        return <pre className="max-h-96 overflow-auto font-mono text-body-xs break-all whitespace-pre-wrap">{text}</pre>
    }
    return <span className="break-all">{text}</span>
}
