'use client'

import { Fragment } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { splitSuggestionLine } from '@/components/Setup/redesign/Invite/suggestion-line'

/**
 * The 09 "Did you mean maria@gmail.com?" row (v7 `etypo`): the translated sentence with the fixed address as a
 * compact secondary chip, the same chip as 04 Invite's suggestions. `line` carries `CHIP_MARKERS.a` for the chip.
 */
export function EmailSuggestion({ line, address, onPick }: { line: string; address: string; onPick: () => void }) {
    const { lead, parts } = splitSuggestionLine(line)
    return (
        <div
            className="mt-1 flex flex-wrap items-center gap-2 text-body-xs text-foreground-secondary"
            data-testid="setup-redesign-email-suggestion"
        >
            {lead && <span>{lead}</span>}
            {/* The spaces only matter to text (screen readers, copy): the flex gap lays the pieces out. */}
            {parts.map((part, i) =>
                'text' in part ? (
                    <Fragment key={i}>
                        {' '}
                        <span>{part.text}</span>
                    </Fragment>
                ) : (
                    <Fragment key={i}>
                        {(lead || i > 0) && ' '}
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            {/* the chip sits inside the email form: a submit button would save the typo */}
                            <Button
                                type="button"
                                variant="secondary"
                                size="compact"
                                shadowSize="2"
                                className="notranslate"
                                translate="no"
                                onClick={onPick}
                            >
                                {address}
                            </Button>
                            {part.suffix && <span>{part.suffix}</span>}
                        </span>
                    </Fragment>
                )
            )}
        </div>
    )
}
