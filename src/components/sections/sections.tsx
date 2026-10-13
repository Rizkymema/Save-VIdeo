import {
  CaretDown,
  ClipboardText,
  CopySimple,
  DownloadSimple,
  Drop,
  FilmStrip,
  MusicNotes,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react/ssr";
import type { ComponentType } from "react";
import type { Dictionary, FaqItem } from "@/i18n/dictionaries/id";

type IconType = ComponentType<{ className?: string; weight?: "bold" | "fill" | "duotone" | "regular"; "aria-hidden"?: boolean }>;

/** Latar hero: dua cahaya ambient + grid halus. Murah untuk GPU (tanpa filter blur). */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute top-[-20rem] left-1/2 h-[40rem] w-[64rem] -translate-x-1/2 animate-drift rounded-full bg-[radial-gradient(closest-side,var(--glow-a),transparent)]" />
      <div className="absolute top-[8rem] right-[-14rem] h-[30rem] w-[30rem] animate-drift-slow rounded-full bg-[radial-gradient(closest-side,var(--glow-b),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(var(--grid-line)_1px,transparent_1px),linear-gradient(90deg,var(--grid-line)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)] bg-[size:56px_56px]" />
    </div>
  );
}

export function Eyebrow({ children }: { children: string }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
      <Sparkle weight="fill" className="size-3.5 text-primary" aria-hidden />
      {children}
    </p>
  );
}

const STEP_ICONS: IconType[] = [CopySimple, ClipboardText, DownloadSimple];

export function HowItWorks({ dict }: { dict: Dictionary }) {
  return (
    <section id="how" aria-labelledby="how-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="max-w-2xl">
        <h2 id="how-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
          {dict.how.title}
        </h2>
        <p className="mt-2 text-muted-foreground">{dict.how.subtitle}</p>
      </div>
      <ol className="mt-8 grid gap-4 sm:grid-cols-3">
        {dict.how.steps.map((step, i) => {
          const Icon = STEP_ICONS[i] ?? DownloadSimple;
          return (
            <li key={step.title} className="rounded-2xl border border-border bg-card/60 p-5">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <Icon weight="bold" className="size-[22px]" aria-hidden />
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const FEATURE_ICONS: IconType[] = [FilmStrip, Drop, MusicNotes, ShieldCheck];

export function Features({ dict }: { dict: Dictionary }) {
  return (
    <section aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
      <h2 id="features-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
        {dict.features.title}
      </h2>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {dict.features.items.map((feature, i) => {
          const Icon = FEATURE_ICONS[i] ?? Sparkle;
          return (
            <li
              key={feature.title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card/60 p-6 transition-colors duration-200 hover:border-primary/40"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon weight="duotone" className="size-6" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** FAQ memakai <details> native: bisa dibuka tanpa JavaScript, aksesibel, nol biaya hydration. */
export function Faq({ title, items }: { title: string; items: FaqItem[] }) {
  return (
    <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <h2 id="faq-title" className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card/60 px-5">
        {items.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex min-h-12 list-none items-center justify-between gap-4 rounded-lg py-3 text-[15px] font-medium transition-colors marker:hidden hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              {item.q}
              <CaretDown
                weight="bold"
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              />
            </summary>
            <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Data terstruktur (schema.org) agar mesin pencari memahami halaman & FAQ. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
