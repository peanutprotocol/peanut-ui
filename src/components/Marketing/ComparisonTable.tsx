import { Card } from '@/components/0_Bruddle/Card'

interface ComparisonTableProps {
    peanutName?: string
    competitorName: string
    rows: Array<{ feature: string; peanut: string; competitor: string }>
}

export function ComparisonTable({ peanutName = 'Peanut', competitorName, rows }: ComparisonTableProps) {
    return (
        <Card shadowSize="4" className="overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-n-1 bg-primary-1/20">
                        <th className="px-4 py-3 font-semibold">Feature</th>
                        <th className="px-4 py-3 font-bold">{peanutName}</th>
                        <th className="px-4 py-3 font-semibold">{competitorName}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className={i % 2 === 1 ? 'bg-primary-3/30' : ''}>
                            <td className="border-b border-n-1/20 px-4 py-3 font-medium">{row.feature}</td>
                            <td className="border-b border-n-1/20 bg-primary-1/10 px-4 py-3">{row.peanut}</td>
                            <td className="border-b border-n-1/20 px-4 py-3">{row.competitor}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Card>
    )
}
