import * as assets from '@/assets'

export function Blog() {
    return (
        <div className="flex h-full flex-col-reverse lg:flex-row">
            <div className="-ml-16 w-4/5 md:w-1/2 ">
                <img src={assets.PEANUTMAN_SAD.src} className="h-full w-auto" />
            </div>
            <div className="my-32 flex w-3/4 flex-col justify-center gap-0 self-end px-8 text-xl font-light italic text-black lg:self-auto lg:text-3xl">
                <span className="font-bold dark:text-white">{'<'} No blog posts yet! Check back later!</span>
            </div>
        </div>
    )
}
