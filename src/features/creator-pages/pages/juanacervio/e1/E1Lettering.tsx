import styles from '../NitaE1.module.css'
import { E1_LETTERING_OUTLINES, type E1LetteringText } from './lettering-outlines'

// All lengths are in the outlines' 1000-unit em.
/** The poster's condensed look: the app's Roboto Flex has no width axis, so the caps are squeezed. */
const SQUEEZE = 0.64
const LINE_PITCH = 900
const OUTLINE = 93
const SHADOW_DROP = 58

/**
 * The poster headline drawn as shapes instead of type, so it fits its box whatever the visitor's
 * text size is. An Android webview multiplies every font size by the system font scale; as text,
 * the headline grew past the column and under her post. The caller supplies the readable heading.
 */
export function E1Lettering({ lines, accentLine }: { lines: readonly E1LetteringText[]; accentLine: number }) {
    const outlines = lines.map((line) => E1_LETTERING_OUTLINES[line])
    const edge = OUTLINE / 2
    const top = outlines[0].top + edge
    const width = Math.max(...outlines.map(({ advance }) => advance)) * SQUEEZE + 2 * edge * SQUEEZE
    const height = top + (lines.length - 1) * LINE_PITCH + edge + SHADOW_DROP

    return (
        <svg
            className={styles.lettering}
            viewBox={`${-edge * SQUEEZE} ${-top} ${width} ${height}`}
            preserveAspectRatio="xMinYMin meet"
            aria-hidden
        >
            <g transform={`scale(${SQUEEZE} 1)`} strokeWidth={OUTLINE} strokeLinejoin="round">
                {outlines.map(({ d }, index) => (
                    <g key={lines[index]} transform={`translate(0 ${index * LINE_PITCH})`}>
                        <path d={d} transform={`translate(0 ${SHADOW_DROP})`} className={styles.letteringEdge} />
                        <path d={d} className={styles.letteringEdge} />
                        <path d={d} className={index === accentLine ? styles.letteringAccent : undefined} />
                    </g>
                ))}
            </g>
        </svg>
    )
}
