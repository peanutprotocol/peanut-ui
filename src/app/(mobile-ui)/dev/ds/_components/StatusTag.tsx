const styles = {
    production: 'bg-green-1/30 text-n-1',
    limited: 'bg-yellow-1/30 text-n-1',
    unused: 'bg-n-1/10 text-grey-1',
    'needs-refactor': 'bg-error-1/30 text-n-1',
}

const labels = {
    production: 'production',
    limited: 'limited use',
    unused: 'unused',
    'needs-refactor': 'needs refactor',
}

export function StatusTag({ status }: { status: 'production' | 'limited' | 'unused' | 'needs-refactor' }) {
    return (
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${styles[status]}`}>
            {labels[status]}
        </span>
    )
}
