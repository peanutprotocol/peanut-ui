import { PROSE_WIDTH } from '@/components/Marketing/constants'
import { DEMO_TABLE } from '../_components/preview-data'

/**
 * The ruled table treatment (table-tints A, 2026-10-14): plain tokens only —
 * cream header row on background-page, white body rows on background-default,
 * full-strength border-default rules. No pink tint, no faded /10 rules. The
 * mdx element map still ships bg-action-primary/15 on th and
 * border-border-default/10 on td; that fix lands in this run's themed fix
 * branch — this page renders the RULED look it must converge on.
 */
export default function ContentTablePreview() {
    return (
        <main className="bg-background-page py-10">
            <div className={`mx-auto ${PROSE_WIDTH} px-6 md:px-4`}>
                {/* x-auto, not hidden: a table wider than the phone scrolls inside the border */}
                <div className="overflow-x-auto rounded-sm border border-border-default">
                    <table className="w-full border-collapse text-left text-body-s">
                        <thead>
                            <tr>
                                {DEMO_TABLE.headers.map((header) => (
                                    <th
                                        key={header}
                                        className="border-b border-border-default bg-background-page px-4 py-3 text-label-m tracking-wide text-foreground-primary uppercase"
                                    >
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {DEMO_TABLE.rows.map((row) => (
                                <tr key={row[0]} className="bg-background-default">
                                    {row.map((cell) => (
                                        <td
                                            key={cell}
                                            className="border-b border-border-default px-4 py-3 text-foreground-secondary"
                                        >
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    )
}
