export function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-body-s text-foreground-secondary">{label}</span>
            <span className="text-body-s text-foreground-primary">{value}</span>
        </div>
    )
}
