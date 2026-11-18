import Image from 'next/image'
import logo from '@/assets/brand/logo.svg'

/** The sender line on a push, as the OS shows it: the app's name, never translated. */
const SENDER = 'Peanut'

/** One push banner in the 10 hero (mock `.push`): the app logo tile, "Peanut", a title and a one-line body. */
export function PushBanner({ title, body }: { title: string; body: string }) {
    return (
        <div className="flex w-[300px] items-center gap-2.5 rounded-sm border border-border-default bg-background-default px-3 py-2.5 shadow-4">
            <span className="flex size-[34px] flex-none items-center justify-center rounded-lg border border-border-default bg-background-accent-yellow">
                <Image src={logo} alt="" className="h-[21px] w-auto" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-body-xs font-bold">{SENDER}</span>
                <span className="block text-body-m font-extrabold">{title}</span>
                <span className="block truncate text-body-s text-foreground-secondary">{body}</span>
            </span>
        </div>
    )
}
