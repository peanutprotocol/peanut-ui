import { PeanutGuyGIF } from '@/assets'

export function Careers() {
    return (
        <div className="flex h-full flex-col-reverse items-center justify-center lg:flex-row">
            <div className="w-4/5 md:w-1/2">
                <img src={PeanutGuyGIF.src} className="h-full w-auto md:h-fit md:w-fit" />
            </div>
            <div>
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
