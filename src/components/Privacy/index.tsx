import { PeanutGuyGIF } from '@/assets'

export function Privacy() {
    return (
        <div className="flex h-full flex-col-reverse items-center lg:flex-row">
            <div className="-ml-16 w-4/5 md:w-1/2">
                <img src={PeanutGuyGIF.src} className="h-full w-auto md:h-fit md:w-fit" />
            </div>
            <div className="my-16 flex w-3/4 flex-col justify-center gap-0 self-center md:my-32 md:px-8 lg:self-auto">
                <div className="font-display text-xl lg:text-3xl">{'<'} Hey there! This is how we treat ur data.</div>
                <div className="font-display text-2xl md:text-4xl lg:text-7xl">Privacy Policy</div>

                <div className="mt-4 text-xl font-bold md:mt-8">
                    We are no creeps! Full terms can be found{' '}
                    <a
                        href="https://peanutprotocol.notion.site/Privacy-Policy-37debda366c941f2bbb8db8c113d8c8b"
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
