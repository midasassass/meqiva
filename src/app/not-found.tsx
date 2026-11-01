import { ButtonLink, Logo } from "@/components/ui";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-dvh max-w-lg content-center gap-6 px-4 text-center">
      <Link href="/" className="justify-self-center"><Logo /></Link>
      <h1 className="display-2">This page is not here</h1>
      <p className="text-[15px] text-ink2">
        The link may be out of date, or the garage may no longer be listed. Start from the comparison page and you will
        find what you need.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href="/find">Compare garages</ButtonLink>
        <ButtonLink href="/" variant="outline">Back to home</ButtonLink>
      </div>
    </div>
  );
}
