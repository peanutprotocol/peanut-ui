/**
 * One bank-detail card in the 05 art (a UI object, mock 05-accounts `.bank`): a currency and rail header, then
 * label/value rows.
 */
export function BankDetailsCard({
    header,
    rows,
    testId,
}: {
    header: string
    rows: readonly (readonly [string, string])[]
    testId?: string
}) {
    return (
        <div
            className="w-[236px] rounded-sm border-2 border-border-default bg-background-default px-3.5 py-3 shadow-4"
            data-bank-card={header}
            data-testid={testId}
        >
            <p className="mb-1 text-heading-card font-extrabold">{header}</p>
            {rows.map(([label, value]) => (
                <p key={label} className="flex justify-between gap-2 text-body-s">
                    <span className="text-foreground-secondary">{label}</span>
                    <b className="font-bold">{value}</b>
                </p>
            ))}
        </div>
    )
}
