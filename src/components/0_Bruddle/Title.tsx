import type { CSSProperties } from 'react'
import { twMerge } from '@/utils/tw'
import { knerdLetters, knerdOutlineTransform, knerdTitle, knerdWrapperStyle } from './Title.consts'
import { knerdLineStyle } from './Title.utils'
import type { TitleMark, TitleProps } from './Title.types'

/**
 * Break on "\n" to place lines by hand; a plain string wraps as one line.
 * The space after each placed line collapses on screen but keeps the words
 * apart for a screen reader ("SEND IN SECONDS.", not "SEND INSECONDS.").
 * A mark wraps its word in a box on every layer, so they lay out alike;
 * only the layer passed `paintMark` paints the mark.
 */
function Lines({ text, mark, paintMark }: { text: string; mark?: TitleMark; paintMark?: boolean }) {
    const lines = text.split('\n')
    const markLine = mark ? lines.findIndex((line) => line.toLowerCase().includes(mark.word.toLowerCase())) : -1
    return lines.map((line, i) => {
        const tail = i < lines.length - 1 ? ' ' : ''
        if (!mark || i !== markLine) {
            return (
                <span key={i} className="block" style={knerdLineStyle(i)}>
                    {line + tail}
                </span>
            )
        }
        const at = line.toLowerCase().indexOf(mark.word.toLowerCase())
        const end = at + mark.word.length
        return (
            <span key={i} className="block" style={knerdLineStyle(i)}>
                {line.slice(0, at)}
                <span className="relative inline-block">
                    {line.slice(at, end)}
                    {paintMark && mark.node}
                </span>
                {line.slice(end) + tail}
            </span>
        )
    })
}

// Letter and LetterLine stay in this file: design.md routes every Knerd glyph through Title.tsx, and
// ds-lint (knerdOutsideTitle) counts a font-knerd-* class in any other file as drift.

const letterBox: CSSProperties = { lineHeight: knerdTitle.lineHeight, transformOrigin: knerdLetters.origin }

/**
 * One Knerd letter for the Follow the pull hero: a stable anchor (pointer
 * distance is measured on it), a magnet (the pull moves it) and the glyph
 * (the entrance moves it). The outline sits inside the glyph, so every
 * transform moves fill and outline as one. Both layers paint the character
 * from `data-knerd-char` (globals.css), so the h1's text is the sr-only
 * phrase alone, not a letter-by-letter copy of it twice over.
 */
function Letter({ char, offset }: { char: string; offset: boolean }) {
    return (
        <span data-knerd-letter="" className="relative inline-block" style={knerdWrapperStyle}>
            <span data-knerd-magnet="" className="inline-block" style={letterBox}>
                <span data-knerd-glyph="" className="relative inline-block font-knerd-filled" style={letterBox}>
                    <span data-knerd-char={char} className="text-white" />
                    <span
                        data-knerd-char={char}
                        className="pointer-events-none absolute inset-0 origin-top-left font-knerd-outline"
                        style={offset ? { transform: knerdOutlineTransform } : undefined}
                    />
                </span>
            </span>
        </span>
    )
}

const spaceStyle: CSSProperties = { width: `${knerdLetters.space}em` }
const letterLineStyle = (index: number): CSSProperties => ({
    lineHeight: knerdTitle.lineHeight,
    ...knerdLineStyle(index),
})

const joinStyle: CSSProperties = {
    fontSize: `${knerdLetters.join.size}em`,
    fontWeight: knerdLetters.join.weight,
    letterSpacing: knerdLetters.join.letterSpacing,
    marginInline: knerdLetters.join.marginInline,
    lineHeight: 1,
}

/** One letter-split line: words of letters, a fixed spacer between two Knerd words, the join word as itself. */
function LetterLine({ line, index, join, offset }: { line: string; index: number; join?: string; offset: boolean }) {
    const words = line.split(' ').filter(Boolean)
    const isJoin = (word: string) => !!join && word.toLowerCase() === join.toLowerCase()
    return (
        <span
            aria-hidden
            className="flex items-baseline justify-center whitespace-nowrap"
            style={letterLineStyle(index)}
        >
            {words.map((word, w) => {
                if (isJoin(word)) {
                    return (
                        <span
                            key={w}
                            data-knerd-join=""
                            data-knerd-char={word}
                            className="font-roboto-flex-extrabold self-center normal-case"
                            style={joinStyle}
                        />
                    )
                }
                const spacer = w > 0 && !isJoin(words[w - 1])
                return [
                    spacer && <span key={`${w}-space`} className="inline-block" style={spaceStyle} />,
                    [...word].map((char, c) => <Letter key={`${w}-${c}`} char={char} offset={offset} />),
                ]
            })}
        </span>
    )
}

const lettersStyle: CSSProperties = { lineHeight: knerdTitle.lineHeight, gap: knerdLetters.lineGap }

const Title = ({ text, className, offset = true, letters = false, join, mark }: TitleProps) => {
    if (letters) {
        return (
            <span
                data-knerd-letters=""
                className={twMerge('relative flex flex-col items-center text-center uppercase', className)}
                style={lettersStyle}
            >
                <span className="sr-only">{text.replace(/\n/g, ' ')}</span>
                {text.split('\n').map((line, i) => (
                    <LetterLine key={i} line={line} index={i} join={join} offset={offset} />
                ))}
            </span>
        )
    }
    const outlineStyle: CSSProperties | undefined = offset ? { transform: knerdOutlineTransform } : undefined
    return (
        <span
            className={twMerge('relative inline-block text-center uppercase', mark && 'isolate', className)}
            style={knerdWrapperStyle}
        >
            {/* With a mark, a solid copy of the letters in the ground's colour sits under the
                white fill, where the outline is. The mark paints beneath it, so it passes behind
                every letter whole, including the sliver between the fill and its offset outline. */}
            {mark && (
                <span
                    aria-hidden
                    className={twMerge(
                        'pointer-events-none absolute inset-x-0 top-0 block origin-top-left font-knerd-filled',
                        mark.knockoutClassName
                    )}
                    style={outlineStyle}
                >
                    <Lines text={text} mark={mark} paintMark />
                </span>
            )}
            <span className={twMerge('block font-knerd-filled text-white', mark && 'relative')}>
                <Lines text={text} mark={mark} />
            </span>
            <span
                aria-hidden
                className="absolute inset-x-0 top-0 block origin-top-left font-knerd-outline"
                style={outlineStyle}
            >
                <Lines text={text} mark={mark} />
            </span>
        </span>
    )
}

Title.displayName = 'Title'

export { Title }
export default Title
