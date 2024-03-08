import peanutman_happy from '@/assets/peanutman-happy.svg'
import * as global_components from '@/components/global'

export function Jobs() {
    return (
        <global_components.PageWrapper bgColor="bg-yellow">
            <div className="flex flex-col-reverse lg:flex-row">
                <div className="-ml-16 w-4/5 md:w-1/2 ">
                    <img src={peanutman_happy.src} className="h-full w-auto" />
                </div>
                <div className="my-32 inline flex w-3/4 flex-col justify-center gap-0 self-end px-8 text-xl font-light italic text-black lg:self-auto lg:text-3xl">
                    <div>
                        <span className="font-bold">{'<'} Hey there! Want to work at Peanut?</span>
                    </div>

                    <div className="mt-2 text-lg">
                        Check out our open{' '}
                        <a
                            href="https://www.notion.so/peanutprotocol/Work-with-Us-b351de56d92e405e962f0027b3a60f52?pvs=4"
                            target="_blank"
                            className="text-black underline"
                        >
                            Job Positions!
                        </a>
                    </div>
                </div>
            </div>{' '}
        </global_components.PageWrapper>
    )
}
