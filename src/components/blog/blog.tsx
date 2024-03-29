import peanutman_sad from '@/assets/peanut/peanutman-sad.svg'
import * as global_components from '@/components/global'

export function Blog() {
    return (
        <global_components.PageWrapper showMarquee={false} bgColor="bg-lightblue">
            <div className="flex flex-col-reverse lg:flex-row">
                <div className="-ml-16 w-4/5 md:w-1/2 ">
                    <img src={peanutman_sad.src} className="h-full w-auto" />
                </div>
                <div className="my-32 inline flex w-3/4 flex-col justify-center gap-0 self-end px-8 text-xl font-light italic text-black lg:self-auto lg:text-3xl">
                    <span className="font-bold">{'<'} No blog posts yet! Check back later!</span>
                </div>
            </div>{' '}
        </global_components.PageWrapper>
    )
}
