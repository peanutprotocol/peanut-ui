'use client'

import { Accordion } from '@/components/0_Bruddle/Accordion'
import { FINDINGS } from './journeyData'

/**
 * The inventory's product-issue findings as collapsible warning cards —
 * real gaps in the activation journey, kept visible next to the board.
 */
export default function FindingsStrip({ showDev }: { showDev: boolean }) {
    return (
        <Accordion type="multiple">
            {FINDINGS.map((finding) => (
                <Accordion.Item key={finding.id} value={String(finding.id)}>
                    <Accordion.Trigger>
                        {finding.id}. {finding.title}
                    </Accordion.Trigger>
                    <Accordion.Content>
                        <p>{finding.detail}</p>
                        {showDev && (
                            <p className="mt-2 font-mono text-body-xs leading-relaxed break-all text-foreground-secondary">
                                {finding.sourceFiles.join(' · ')}
                            </p>
                        )}
                    </Accordion.Content>
                </Accordion.Item>
            ))}
        </Accordion>
    )
}
