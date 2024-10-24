import * as assets from '@/assets'
export function Jobs() {
    return (
        <div className="flex h-full flex-col-reverse lg:flex-row">
            <div className="-ml-16 w-4/5 md:w-1/2 ">
                <img src={assets.PEANUTMAN_HAPPY.src} className="h-full w-auto" />
            </div>
            <div className="my-32 inline flex w-3/4 flex-col justify-center gap-0 self-end px-8 lg:self-auto">
                <div className="font-display text-xl lg:text-3xl">{'<'} Hey there! Want to work at Peanut?</div>

                <div className="mt-4 text-lg">
                    Check out our open{' '}
                    <a
                        href="https://www.notion.so/peanutprotocol/Work-with-Us-b351de56d92e405e962f0027b3a60f52?pvs=4"
                        target="_blank"
                        className="text-link"
                    >
                        Job Positions!
                    </a>
                </div>
            </div>
        </div>
    )
}
