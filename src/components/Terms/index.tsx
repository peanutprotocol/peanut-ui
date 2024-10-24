import * as assets from '@/assets'
export function Terms() {
    return (
        <div className="flex h-full flex-col-reverse text-black dark:text-white lg:flex-row">
            <div className="-ml-16 w-4/5 md:w-1/2 ">
                <img src={assets.PEANUTMAN_PRESENTING.src} className="h-full w-auto" />
            </div>
            <div className="my-32 inline flex w-3/4 flex-col justify-center gap-0 self-end px-8 lg:self-auto">
                <div className="font-display text-xl lg:text-3xl">{'<'} Hey there! These are our TOS.</div>
                <div className="font-display text-2xl md:text-4xl lg:text-7xl">Terms of Service</div>

                <div className="mt-4 text-xl font-bold md:mt-8">
                    Don't do illegal stuff pls :( Full terms can be found{' '}
                    <a
                        href="https://peanutprotocol.notion.site/Terms-of-Service-1f245331837f4b7e860261be8374cc3a"
                        className="text-link"
                    >
                        here
                    </a>
                </div>

                <div className="mt-2 text-lg">
                    {' '}
                    If you have any questions, you can always get in touch{' '}
                    <a href="https://discord.gg/BX9Ak7AW28" target="_blank" className="text-link">
                        with us!{' '}
                    </a>
                </div>
            </div>
        </div>
    )
}
