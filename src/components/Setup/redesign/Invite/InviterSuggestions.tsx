'use client'

import { Button } from '@/components/0_Bruddle/Button'
import type { SuggestionPart } from './suggestion-line'

/**
 * The "Did you mean" row: compact secondary chips (36 px, 2 px shadow, pink when pressed) inside the translated
 * sentence. `lead` is empty when a small phone moved the lead words up beside the error line (mock liftLead).
 */
export function InviterSuggestions({
    lead,
    parts,
    names,
    onPick,
}: {
    lead: string
    parts: SuggestionPart[]
    names: string[]
    onPick: (name: string, position: number) => void
}) {
    return (
        <div
            className="mt-2 flex flex-wrap items-center gap-2 text-body-xs text-foreground-secondary signup-sm:mt-1"
            data-testid="setup-redesign-invite-suggestions"
        >
            {lead && <span>{lead}</span>}
            {parts.map((part, i) =>
                'text' in part ? (
                    <span key={i}>{part.text}</span>
                ) : (
                    <span key={i} className="inline-flex items-center gap-1 whitespace-nowrap">
                        <Button
                            variant="secondary"
                            size="compact"
                            shadowSize="2"
                            className="notranslate"
                            translate="no"
                            onClick={() => onPick(names[part.chip], part.chip + 1)}
                        >
                            {`@${names[part.chip]}`}
                        </Button>
                        {part.suffix && <span>{part.suffix}</span>}
                    </span>
                )
            )}
        </div>
    )
}
