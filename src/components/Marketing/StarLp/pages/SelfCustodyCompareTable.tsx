const ROWS = [
    { id: 'holds', question: 'Who holds it', usual: 'The app', peanut: 'You' },
    { id: 'freeze', question: 'Who can freeze it', usual: 'The app', peanut: 'Not Peanut' },
    { id: 'approves', question: 'Who approves sends', usual: 'The app', peanut: 'You' },
]

/** Three rows, usual app against Peanut. */
export function SelfCustodyCompareTable() {
    return (
        <div className="overflow-hidden rounded-sm border-2 border-border-default bg-background-default shadow-4">
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
                    {ROWS.map((row) => (
                        <tr key={row.id} className="border-t-2 border-border-default align-top">
                            <th scope="row" className="p-2 text-label-l text-balance">
                                {row.question}
                            </th>
                            <td className="p-2">{row.usual}</td>
                            <td className="bg-background-badge-success p-2 text-label-l">{row.peanut}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
