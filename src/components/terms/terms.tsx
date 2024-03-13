import peanutman_presenting from '@/assets/peanut/peanutman-presenting.svg'
import * as global_components from '@/components/global'

export function Terms() {
    return (
        <global_components.PageWrapper>
            <div className="flex flex-col-reverse lg:flex-row">
                <div className="-ml-16 w-4/5 md:w-1/2 ">
                    <img src={peanutman_presenting.src} className="h-full w-auto" />
                </div>
                <div className="my-32 inline flex w-3/4 flex-col justify-center gap-0 self-end px-8 text-xl font-light italic text-black lg:self-auto lg:text-3xl">
                    <div>
                        <span className="font-bold">{'<'} Hey there! These are our TOS.</span>
                    </div>
                    <div className="py-2 text-2xl font-bold  md:text-4xl lg:text-8xl">Terms of Service</div>

                    <div className="text-xl font-bold ">
                        Don't do illegal stuff pls :( Full terms can be found{' '}
                        <a
                            href="https://peanutprotocol.notion.site/Terms-of-Service-1f245331837f4b7e860261be8374cc3a"
                            className="text-white underline hover:text-black"
                        >
                            here
                        </a>
                    </div>

                    <div className="mt-2 text-lg">
                        {' '}
                        If you have any questions, you can always get in touch{' '}
                        <a
                            href="https://discord.gg/BX9Ak7AW28"
                            target="_blank"
                            className="text-black underline hover:text-white"
                        >
                            with us!{' '}
                        </a>
                    </div>
                </div>
            </div>
        </global_components.PageWrapper>
    )
}
