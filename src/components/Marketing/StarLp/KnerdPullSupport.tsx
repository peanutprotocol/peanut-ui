import { KNERD_PULL_HELP_ID } from './starLp.consts'

// No script, no entrance: the letters and the join word show at rest.
const NO_JS =
    '<style>[data-knerd-pull] [data-knerd-glyph],[data-knerd-pull] [data-knerd-join]{opacity:1!important;animation:none!important}</style>'

/**
 * What the Follow the pull headline needs beside it, kept out of the h1 so the
 * heading's text is only its words: the no-JS style and the hidden how-to the
 * headline names as its description.
 */
export function KnerdPullSupport() {
    return (
        <>
            <noscript dangerouslySetInnerHTML={{ __html: NO_JS }} />
            <span id={KNERD_PULL_HELP_ID} hidden>
                Move your pointer over the letters or tap them. Press Enter or Space when the headline is focused to try
                the magnetic effect.
            </span>
        </>
    )
}
