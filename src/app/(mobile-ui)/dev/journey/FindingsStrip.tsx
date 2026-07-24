'use client'

import { FINDINGS } from './journeyData'

/**
 * The inventory's product-issue findings as collapsible warning cards —
 * real gaps in the activation journey, kept visible next to the board.
 */
export default function FindingsStrip() {
    return (
        <div className="flex flex-col gap-2">
            {FINDINGS.map((finding) => (
                <details key={finding.id} className="rounded-sm border border-n-1 bg-yellow-1/40">
                    <summary className="cursor-pointer select-none px-3 py-2 text-sm font-bold">
                        ⚠️ {finding.id}. {finding.title}
                    </summary>
                    <div className="border-t border-n-1 bg-white px-3 py-2">
                        <p className="text-sm">{finding.detail}</p>
                        <p className="mt-1.5 break-all font-mono text-[10px] leading-relaxed text-grey-1">
                            {finding.sourceFiles.join(' · ')}
                        </p>
                    </div>
                </details>
            ))}
        </div>
    )
}
