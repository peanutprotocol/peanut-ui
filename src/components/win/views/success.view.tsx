export function WinSuccesView() {
    return (
        <>
            <h2 className="my-0 text-center text-3xl font-black lg:text-6xl ">You got</h2>
            <h1 className=" text-md mb-8 mt-4 text-center font-black sm:text-6xl lg:text-8xl ">$13.37</h1>
            <h3 className="text-md mb-4 mt-2 text-center font-normal sm:text-lg lg:text-xl ">
                Create a red packet link to send to your friend group chat
            </h3>
            <button
                type={'button'}
                className="mt-2 block w-[90%] cursor-pointer bg-white p-5 px-2  text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
                onClick={() => {}} //TODO: change redirect here
            >
                Create
            </button>
        </>
    )
}
