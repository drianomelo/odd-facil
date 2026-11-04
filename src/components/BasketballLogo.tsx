import Image from "next/image";

export function BasketballLogo() {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#00519F] ring-1 ring-inset ring-white/20"
      aria-hidden="true"
    >
      <Image
        src="/logo.svg"
        alt=""
        width={28}
        height={28}
        priority
        className="h-7 w-7 object-contain"
      />
    </span>
  );
}
