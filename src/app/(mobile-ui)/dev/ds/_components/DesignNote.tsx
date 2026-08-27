import { Icon } from '@/components/Global/Icons/Icon'

// badge tokens, matching the Notification surface vocabulary
const styles = {
    warning: {
        container: 'border-foreground-over-color-secondary bg-background-badge-attention',
        icon: 'text-foreground-primary',
        iconName: 'alert' as const,
    },
    info: {
        container: 'border-foreground-over-color-secondary bg-background-badge-info',
        icon: 'text-foreground-primary',
        iconName: 'info' as const,
    },
}

export function DesignNote({ type, children }: { type: 'warning' | 'info'; children: React.ReactNode }) {
    const s = styles[type]
    return (
        <div className={`flex items-start gap-3 rounded-sm border p-4 text-body-s ${s.container}`}>
            <Icon name={s.iconName} size={16} className={`mt-0.5 shrink-0 ${s.icon}`} />
            <div className="font-bold">{children}</div>
        </div>
    )
}
