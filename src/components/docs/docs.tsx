import peanutman_happy from '@/assets/peanutman-happy.svg'

export function Docs() {
    return (
        <div className="flex flex-col-reverse lg:flex-row">
            <div className="-ml-16 w-4/5 md:w-1/2 ">
                <img src={peanutman_happy.src} className="h-full w-auto" />
            </div>
            <div className="my-32 inline flex w-3/4 flex-col justify-center gap-0 self-end px-8 text-xl font-light italic text-black lg:self-auto lg:text-3xl">
                <div>
                    <span className="font-bold">{'<'} Hey there! Looking for the docs?</span>
                </div>

                <div className="mt-2 text-lg">
                    Click{' '}
                    <a
                        href="https://peanutprotocol.gitbook.io/peanut-protocol-docs-1/overview/what-we-do"
                        target="_blank"
                        className="text-black underline"
                    >
                        here
                    </a>{' '}
                    to check them out
                </div>
            </div>
        </div>
    )
}
