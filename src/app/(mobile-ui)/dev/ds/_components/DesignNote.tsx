import { Icon } from '@/components/Global/Icons/Icon'

const styles = {
    warning: {
        container: 'border-yellow-1/40 bg-yellow-1/20',
        icon: 'text-foreground-primary',
        iconName: 'alert' as const,
    },
    info: {
        container: 'border-primary-3 bg-primary-3/20',
        icon: 'text-foreground-primary',
        iconName: 'info' as const,
    },
}

export function DesignNote({ type, children }: { type: 'warning' | 'info'; children: React.ReactNode }) {
    const s = styles[type]
    return (
        <div className={`flex items-start gap-3 rounded-sm border p-4 text-body-s ${s.container}`}>
            <Icon name={s.iconName} size={18} className={`mt-0.5 shrink-0 ${s.icon}`} />
            <div className="leading-relaxed font-bold">{children}</div>
        </div>
    )
}
