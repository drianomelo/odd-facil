import Image from "next/image";

export function BasketballLogo() {
  return (
    <Image
      src="/logo.svg"
      alt=""
      width={32}
      height={32}
      priority
      className="h-8 w-8 object-contain"
    />
  );
}
