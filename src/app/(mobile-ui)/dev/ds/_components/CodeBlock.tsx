'use client'

import { useState } from 'react'
import { Icon } from '@/components/Global/Icons/Icon'
import { useHighlightedCode } from '../_hooks/useHighlightedCode'

interface CodeBlockProps {
    code: string
    label?: string
    language?: string
}

export function CodeBlock({ code, label, language = 'tsx' }: CodeBlockProps) {
    const html = useHighlightedCode(code, language)
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <div>
            <div className="flex items-center justify-between">
                {label && <span className="text-xs font-bold uppercase tracking-wider text-grey-1">{label}</span>}
                <button onClick={handleCopy} className="ml-auto text-grey-1 opacity-40 hover:opacity-100">
                    {copied ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}
                </button>
            </div>
            <div
                className="shiki-code mt-2 overflow-x-auto rounded-sm text-[13px] leading-relaxed [&_code]:block [&_pre]:!bg-transparent [&_pre]:p-0"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    )
}
