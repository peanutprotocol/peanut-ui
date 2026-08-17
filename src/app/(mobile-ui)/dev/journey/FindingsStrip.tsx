'use client'

import { FINDINGS } from './journeyData'

/**
 * The inventory's product-issue findings as collapsible warning cards —
 * real gaps in the activation journey, kept visible next to the board.
 */
export default function FindingsStrip({ showDev }: { showDev: boolean }) {
    return (
        <div className="flex flex-col gap-2">
            {FINDINGS.map((finding) => (
                <details key={finding.id} className="rounded-sm border border-n-1 bg-yellow-1/40">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-bold select-none">
                        ⚠️ {finding.id}. {finding.title}
                    </summary>
                    <div className="border-t border-n-1 bg-white px-3 py-2">
                        <p className="text-sm">{finding.detail}</p>
                        {showDev && (
                            <p className="mt-1.5 font-mono text-[10px] leading-relaxed break-all text-grey-1">
                                {finding.sourceFiles.join(' · ')}
                            </p>
                        )}
                    </div>
                </details>
            ))}
        </div>
    )
}
