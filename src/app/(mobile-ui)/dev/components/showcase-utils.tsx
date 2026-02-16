'use client'

import { useState } from 'react'
import { Icon } from '@/components/Global/Icons/Icon'

// copy code snippet to clipboard with visual feedback
export const CopySnippet = ({ code }: { code: string }) => {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <button
            onClick={handleCopy}
            className="group relative mt-1 flex w-full items-start gap-2 rounded-sm border border-n-1/20 bg-primary-3/20 px-3 py-2 text-left font-mono text-[11px] text-grey-1 hover:border-n-1/40"
        >
            <span className="flex-1 whitespace-pre-wrap break-all">{code}</span>
            <span className="shrink-0 opacity-40 group-hover:opacity-100">
                {copied ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}
            </span>
        </button>
    )
}

// production readiness badge
export const StatusTag = ({ status }: { status: 'production' | 'limited' | 'unused' | 'needs-refactor' }) => {
    const styles = {
        production: 'bg-green-1/30 text-n-1',
        limited: 'bg-yellow-1/30 text-n-1',
        unused: 'bg-n-1/10 text-grey-1',
        'needs-refactor': 'bg-error-1/30 text-n-1',
    }
    const labels = {
        production: 'production',
        limited: 'limited use',
        unused: 'unused',
        'needs-refactor': 'needs refactor',
    }
    return (
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${styles[status]}`}>
            {labels[status]}
        </span>
    )
}

// quality score stars (1-5)
export const QualityScore = ({ score, label }: { score: 1 | 2 | 3 | 4 | 5; label?: string }) => {
    const descriptions: Record<number, string> = {
        1: 'needs rewrite',
        2: 'works but messy',
        3: 'decent',
        4: 'clean',
        5: 'elegant',
    }
    return (
        <span className="inline-flex items-center gap-1 text-[10px] text-grey-1" title={label || descriptions[score]}>
            {'★'.repeat(score)}
            {'☆'.repeat(5 - score)}
            {label && <span className="ml-0.5">{label}</span>}
        </span>
    )
}

// usage count badge
export const UsageCount = ({ count }: { count: number }) => (
    <span className="text-[10px] text-grey-1">
        {count} usage{count !== 1 ? 's' : ''}
    </span>
)

// section wrapper with title, status, quality, and usage count
export const Section = ({
    title,
    id,
    status,
    quality,
    usages,
    importPath,
    children,
}: {
    title: string
    id?: string
    status?: 'production' | 'limited' | 'unused' | 'needs-refactor'
    quality?: 1 | 2 | 3 | 4 | 5
    usages?: number
    importPath?: string
    children: React.ReactNode
}) => (
    <div id={id} className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{title}</h2>
            {status && <StatusTag status={status} />}
            {quality && <QualityScore score={quality} />}
            {usages !== undefined && <UsageCount count={usages} />}
        </div>
        {importPath && <CopySnippet code={importPath} />}
        {children}
    </div>
)

// props table
export const PropTable = ({ rows }: { rows: [string, string, string][] }) => (
    <div className="overflow-x-auto rounded-sm border border-n-1 text-xs">
        <table className="w-full">
            <thead>
                <tr className="border-b border-n-1 bg-primary-3/20">
                    <th className="px-3 py-1.5 text-left font-bold">prop</th>
                    <th className="px-3 py-1.5 text-left font-bold">options</th>
                    <th className="px-3 py-1.5 text-left font-bold">default</th>
                </tr>
            </thead>
            <tbody>
                {rows.map(([prop, options, def]) => (
                    <tr key={prop} className="border-b border-n-1 last:border-0">
                        <td className="px-3 py-1.5 font-mono font-bold">{prop}</td>
                        <td className="px-3 py-1.5 font-mono">{options}</td>
                        <td className="px-3 py-1.5 font-mono">{def}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
)
