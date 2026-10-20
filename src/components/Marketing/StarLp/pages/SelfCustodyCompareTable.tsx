import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'

const ROWS = [
    { id: 'holds', question: 'Who holds it', usual: 'The app', peanut: 'You' },
    { id: 'freeze', question: 'Who can freeze it', usual: 'The app', peanut: 'Not Peanut' },
    { id: 'approves', question: 'Who approves sends', usual: 'The app', peanut: 'You' },
]

// The table pops in with the phones; the Peanut answers then land one by one,
// like the "Funds on hold" stamp beside it.
const TABLE_DELAY = 0.2
const ANSWER_DELAY = 0.7
const ANSWER_STEP = 0.15

/** Three rows, usual app against Peanut. */
export function SelfCustodyCompareTable() {
    return (
        <PopIn
            delay={TABLE_DELAY}
            className="overflow-hidden rounded-sm border-2 border-border-default bg-background-default shadow-4"
        >
            <table className="w-full table-fixed border-collapse text-left text-body-s">
                <thead>
                    <tr className="text-label-m uppercase">
                        <th className="w-[44%] bg-yellow-500 p-2 min-[380px]:w-1/2 md:w-[36%]">
                            <span className="sr-only">Question</span>
                        </th>
                        <th className="bg-yellow-500 p-2">Usual app</th>
                        <th className="bg-background-brand p-2">Peanut</th>
                    </tr>
                </thead>
                <tbody>
                    {ROWS.map((row, i) => (
                        <tr key={row.id} className="border-t-2 border-border-default align-top">
                            <th scope="row" className="p-2 text-label-l text-balance">
                                {row.question}
                            </th>
                            <td className="p-2">{row.usual}</td>
                            <td className="bg-background-badge-success p-2 text-label-l">
                                <DropIn delay={ANSWER_DELAY + i * ANSWER_STEP} fromTilt={-8} className="inline-block">
                                    {row.peanut}
                                </DropIn>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </PopIn>
    )
}
