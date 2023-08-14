import peanutman_presenting from "@/assets/peanutman-presenting.svg";

export function Privacy() {
  return (
    <div className="flex flex-col-reverse lg:flex-row">
      <div className="w-4/5 md:w-1/2 -ml-16 ">
        <img src={peanutman_presenting.src} className="h-full w-auto" />
      </div>
      <div className="text-xl lg:text-3xl font-light text-black flex flex-col gap-0 italic inline px-8 w-3/4 justify-center my-32 self-end lg:self-auto">
        <div>
          <span className="font-bold">
            {"<"} Hey there! This is how we treat ur data.
          </span>
        </div>
        <div className="text-2xl md:text-4xl lg:text-8xl  font-bold py-2">
          Privacy Policy
        </div>

        <div className="text-xl font-bold ">
          We are no creeps! Full terms can be found{" "}
          <a
            href="https://peanutprotocol.notion.site/Privacy-Policy-37debda366c941f2bbb8db8c113d8c8b"
            className="text-white hover:text-black underline"
          >
            here
          </a>
        </div>

        <div className="text-lg mt-2">
          {" "}
          If you have any questions, you can always get in touch{" "}
          <a
            href="https://discord.gg/BX9Ak7AW28"
            target="_blank"
            className="underline text-black hover:text-white"
          >
            with us!{" "}
          </a>
        </div>
      </div>
    </div>
  );
}
