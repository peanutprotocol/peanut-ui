import peanutman_sad from "@/assets/peanutman-sad.svg";

export function Blog() {
  return (
    <div className="flex flex-col-reverse lg:flex-row">
      <div className="w-4/5 md:w-1/2 -ml-16 ">
        <img src={peanutman_sad.src} className="h-full w-auto" />
      </div>
      <div className="text-xl lg:text-3xl font-light text-black flex flex-col gap-0 italic inline px-8 w-3/4 justify-center my-32 self-end lg:self-auto">
        <span className="font-bold">
          {"<"} No blog posts yet! Check back later!
        </span>
      </div>
    </div>
  );
}
