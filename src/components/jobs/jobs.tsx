import peanutman_happy from "@/assets/peanutman-happy.svg";

export function Jobs() {
  return (
    <div className="flex flex-col-reverse lg:flex-row">
      <div className="w-4/5 md:w-1/2 -ml-16 ">
        <img src={peanutman_happy.src} className="h-full w-auto" />
      </div>
      <div className="text-xl lg:text-3xl font-light text-black flex flex-col gap-0 italic inline px-8 w-3/4 justify-center my-32 self-end lg:self-auto">
        <div>
          <span className="font-bold">
            {"<"} Hey there! Want to work at Peanut?
          </span>
        </div>

        <div className="text-lg mt-2">
          Check out our open{" "}
          <a
            href="https://www.notion.so/peanutprotocol/Work-with-Us-b351de56d92e405e962f0027b3a60f52?pvs=4"
            target="_blank"
            className="underline text-black"
          >
            Job Positions!
          </a>
        </div>
      </div>
    </div>
  );
}
