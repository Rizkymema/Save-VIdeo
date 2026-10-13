import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { id } from "@/i18n/dictionaries/id";

export const metadata = { title: id.notFound.title };

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <LogoMark className="size-12" />
      <p className="mt-6 font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{id.notFound.title}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{id.notFound.body}</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {id.notFound.home}
      </Link>
    </main>
  );
}
