'use client'

import { Fragment } from 'react'
import { splitSuggestionLine } from '@/components/Setup/redesign/Invite/suggestion-line'

/**
 * The 09 "Did you mean maria@gmail.com?" line (v7 `etypo`), in the field's one-line help row: at 375×667 the
 * footer leaves no room for a chip row under the field. The address is a text button; its hit area reaches past
 * the line, as the support link's does. `line` carries `CHIP_MARKERS.a` for the address.
 */
export function EmailSuggestion({ line, address, onPick }: { line: string; address: string; onPick: () => void }) {
    const { lead, parts } = splitSuggestionLine(line)
    return (
        <p data-testid="setup-redesign-email-suggestion">
            {lead}
            {parts.map((part, i) =>
                'text' in part ? (
                    <Fragment key={i}> {part.text}</Fragment>
                ) : (
                    <Fragment key={i}>
                        {(lead || i > 0) && ' '}
                        {/* inside the email form: a submit button would save the typo */}
                        <button
                            type="button"
                            translate="no"
                            className="notranslate relative font-semibold text-foreground-primary underline after:absolute after:inset-x-0 after:-inset-y-3.5"
                            onClick={onPick}
                        >
                            {address}
                        </button>
                        {part.suffix}
                    </Fragment>
                )
            )}
        </p>
    )
}
