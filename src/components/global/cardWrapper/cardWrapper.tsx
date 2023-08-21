export function CardWrapper({
    children,
    mb = ' mb-48 ',
    mt = ' mt-5 ',
    shadow = true,
}: {
    children: React.ReactNode
    mb?: string
    mt?: string
    shadow?: boolean
}) {
    return (
        <div
            className={
                'center-xy brutalborder relative mx-auto flex w-10/12 flex-col items-center bg-white px-4 py-6 text-black  lg:w-2/3 xl:w-1/2 ' +
                mb +
                mt
            }
            id={shadow ? 'cta-div' : ''}
        >
            {' '}
            {children}
        </div>
    )
}
