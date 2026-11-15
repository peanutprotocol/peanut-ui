import styles from '../NitaE1.module.css'
import { E1_LETTERING_OUTLINES, type E1LetteringText } from './lettering-outlines'

// All lengths are in the outlines' 1000-unit em.
/** The poster's condensed look: the app's Roboto Flex has no width axis, so the caps are squeezed. */
const SQUEEZE = 0.64
const LINE_PITCH = 900
const OUTLINE = 93
const SHADOW_DROP = 58
const SHAPES = 'e1-lettering'

/**
 * The poster headline drawn as shapes instead of type, so it fits its box whatever the visitor's
 * text size is. An Android webview multiplies every font size by the system font scale; as text,
 * the headline grew past the column and under her post. The caller supplies the readable heading.
 */
export function E1Lettering({ lines, accentLine }: { lines: readonly E1LetteringText[]; accentLine: number }) {
    const outlines = lines.map((line) => E1_LETTERING_OUTLINES[line])
    const edge = OUTLINE / 2
    const top = outlines[0].top + edge
    const left = Math.round(edge * SQUEEZE)
    const width = Math.round(Math.max(...outlines.map(({ advance }) => advance)) * SQUEEZE) + 2 * left
    const height = top + (lines.length - 1) * LINE_PITCH + Math.max(edge, SHADOW_DROP)

    return (
        <svg
            className={styles.lettering}
            viewBox={`${-left} ${-top} ${width} ${height}`}
            preserveAspectRatio="xMinYMin meet"
            aria-hidden
        >
            {/* The shapes are in the HTML once and drawn three times: the drop, the outline, the fill.
                As on the approved poster, the drop is the letters without their outline. Each copy
                takes its colour from its <use>, which every browser passes down to the shapes. */}
            <defs>
                <g id={SHAPES}>
                    {outlines.map(({ d }, index) => (
                        <path
                            key={lines[index]}
                            id={`${SHAPES}-${index}`}
                            d={d}
                            transform={`translate(0 ${index * LINE_PITCH})`}
                        />
                    ))}
                </g>
            </defs>
            <g transform={`scale(${SQUEEZE} 1)`} strokeWidth={OUTLINE} strokeLinejoin="round">
                <use href={`#${SHAPES}`} transform={`translate(0 ${SHADOW_DROP})`} className={styles.letteringBlack} />
                <use href={`#${SHAPES}`} className={`${styles.letteringBlack} ${styles.letteringEdge}`} />
                {lines.map((line, index) => (
                    <use
                        key={line}
                        href={`#${SHAPES}-${index}`}
                        className={index === accentLine ? styles.letteringAccent : undefined}
                    />
                ))}
            </g>
        </svg>
    )
}
