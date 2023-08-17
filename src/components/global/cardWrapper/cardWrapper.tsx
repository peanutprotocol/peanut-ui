export function CardWrapper({ children, mb = ' mb-48' }: { children: React.ReactNode; mb?: string }) {
    return (
        <div
            className={
                'center-xy brutalborder relative mx-auto mt-5 flex w-10/12 flex-col items-center bg-white px-4 py-6 text-black lg:w-2/3 xl:w-1/2 ' +
                mb
            }
        >
            {' '}
            {children}
        </div>
    )
}
