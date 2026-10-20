import Logo from '@/assets/brand/logo.svg'

/** The Peanut push a minute later: the dollars that landed and the euros they came from. */
export function UsEuMoneyInPush() {
    return (
        <div
            role="img"
            aria-label="Peanut notification: +$1,738.20 from €1,500.00"
            className="flex items-center gap-3 rounded-card border-2 border-border-default bg-background-default p-3 shadow-4"
        >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card border-2 border-border-default bg-background-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={Logo.src}
                    width={Logo.width}
                    height={Logo.height}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="h-6 w-6"
                />
            </span>
            <span>
                <span className="block text-heading-s">+$1,738.20</span>
                <span className="block text-body-s text-foreground-secondary">from €1,500.00</span>
            </span>
        </div>
    )
}
