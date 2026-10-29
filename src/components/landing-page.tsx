const documentExamples = [
  {
    label: "Student handbook",
    detail: "Policies, resources, and campus life",
    kind: "HANDBOOK",
    tone: "lavender",
    icon: "book",
  },
  {
    label: "Academic calendar",
    detail: "Key dates for the year ahead",
    kind: "ACADEMICS",
    tone: "mint",
    icon: "calendar",
  },
  {
    label: "Campus services",
    detail: "Find the support you need",
    kind: "SUPPORT",
    tone: "peach",
    icon: "compass",
  },
] as const;

const productPrinciples = [
  {
    number: "01",
    title: "Start with campus documents",
    description:
      "Bring the everyday information students need into one thoughtfully organized place.",
  },
  {
    number: "02",
    title: "Make information easier to explore",
    description:
      "CampusGPT is being designed to help students find their way through policies, dates, and services.",
  },
  {
    number: "03",
    title: "Keep context close",
    description:
      "Answers should make it clear which campus resources they come from, so the source is never far away.",
  },
] as const;

function BrandMark() {
  return (
    <a
      aria-label="CampusGPT home"
      className="flex w-fit items-center gap-2.5 rounded-sm"
      href="#home"
    >
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-xl bg-[#285c49] text-white"
      >
        <svg fill="none" viewBox="0 0 24 24" className="size-5">
          <path
            d="M4.5 6.75c2.55-.8 5-.45 7.5 1.05v11c-2.5-1.5-4.95-1.85-7.5-1.05v-11Zm15 0c-2.55-.8-5-.45-7.5 1.05v11c2.5-1.5 4.95-1.85 7.5-1.05v-11Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.04em] text-[#1b3028]">
        Campus<span className="text-[#477963]">GPT</span>
      </span>
    </a>
  );
}

function Header() {
  return (
    <header className="relative z-10">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <BrandMark />
        <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-6">
          <a
            className="hidden text-sm font-medium text-[#59655e] transition-colors hover:text-[#285c49] sm:inline-flex"
            href="#how-it-works"
          >
            The idea
          </a>
          <a
            className="hidden text-sm font-medium text-[#59655e] transition-colors hover:text-[#285c49] lg:inline-flex"
            href="#designed-for-campus"
          >
            Designed for campus
          </a>
          <a
            className="hidden min-h-10 items-center justify-center rounded-full border border-[#d9e0d8] px-4 text-sm font-semibold text-[#285c49] transition-colors hover:border-[#285c49] hover:bg-white sm:inline-flex"
            href="#how-it-works"
          >
            Explore the idea
          </a>
          <a
            className="inline-flex min-h-10 items-center justify-center rounded-full px-2 text-sm font-semibold text-[#466352] transition-colors hover:text-[#285c49] sm:px-0"
            href="/login"
          >
            Log in
          </a>
          <a
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#285c49] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#214c3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49]"
            href="/signup"
          >
            Sign up
          </a>
        </nav>
      </div>
    </header>
  );
}

function DocumentPreview() {
  return (
    <div
      aria-label="Illustration of campus resources that could be brought together"
      className="relative mx-auto w-full max-w-[500px]"
      role="img"
    >
      <div
        aria-hidden="true"
        className="absolute -inset-7 rounded-[2.5rem] bg-[#dfe9dd]/70 blur-2xl"
      />
      <div className="relative rotate-[1.5deg] rounded-[1.75rem] border border-[#e5e9e1] bg-white p-5 shadow-[0_24px_80px_-32px_rgba(28,54,40,0.28)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#748078]">
              A more connected campus
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#25362c] sm:text-2xl">
              The things you need,
              <br />
              in one place.
            </h2>
          </div>
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f1f5ed] text-[#477963]"
          >
            <svg fill="none" viewBox="0 0 24 24" className="size-5">
              <path
                d="M12 3.75v3m0 10.5v3m8.25-8.25h-3m-10.5 0h-3m14.083-5.833-2.12 2.12M7.287 16.713l-2.12 2.12m13.666 0-2.12-2.12M7.287 7.287l-2.12-2.12"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.6"
              />
              <circle cx="12" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
        </div>

        <div className="mt-7 flex items-center justify-between border-b border-[#edf0eb] pb-3">
          <p className="text-sm font-semibold text-[#37473d]">Campus resources</p>
          <span className="rounded-full bg-[#f3f5f0] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#728076]">
            An early concept
          </span>
        </div>

        <ul aria-label="Example campus resources" className="mt-2">
          {documentExamples.map((document) => (
            <li
              className="flex items-center gap-3 border-b border-[#edf0eb] py-3.5 last:border-0"
              key={document.label}
            >
              <span
                aria-hidden="true"
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                  document.tone === "lavender"
                    ? "bg-[#f0edfa] text-[#7465a7]"
                    : document.tone === "mint"
                      ? "bg-[#eaf4ed] text-[#4f8564]"
                      : "bg-[#fbf0e7] text-[#b47a4e]"
                }`}
              >
                {document.icon === "book" ? (
                  <svg fill="none" viewBox="0 0 24 24" className="size-[18px]">
                    <path
                      d="M5 5.75h9.5a3 3 0 0 1 3 3V19H8a3 3 0 0 1-3-3V5.75Zm0 10.5a3 3 0 0 1 3-3h9.5M9 9h4m-4 3h4"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                ) : document.icon === "calendar" ? (
                  <svg fill="none" viewBox="0 0 24 24" className="size-[18px]">
                    <rect
                      height="14"
                      rx="2.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      width="15"
                      x="4.5"
                      y="6.5"
                    />
                    <path
                      d="M8 4.75v3.5m8-3.5v3.5m-11.5 2h15M8 14h2m4 0h2m-8 3h2"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                ) : (
                  <svg fill="none" viewBox="0 0 24 24" className="size-[18px]">
                    <path
                      d="M19 10.25c0 5-7 10-7 10s-7-5-7-10a7 7 0 1 1 14 0Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <circle cx="12" cy="10.25" r="2.25" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#34443a]">
                  {document.label}
                </span>
                <span className="mt-0.5 block text-xs text-[#7a857d]">
                  {document.detail}
                </span>
              </span>
              <span className="hidden text-[9px] font-semibold tracking-[0.12em] text-[#879088] sm:block">
                {document.kind}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-3 rounded-xl bg-[#f7f8f5] px-3.5 py-3 text-xs leading-5 text-[#68746c]">
          A concept for making campus knowledge feel a little closer.
        </p>
      </div>
      <div
        aria-hidden="true"
        className="absolute -bottom-6 -left-3 -z-0 hidden -rotate-3 rounded-2xl border border-[#e4e9df] bg-[#fafbf8] px-5 py-4 shadow-lg sm:block"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7b897e]">
          Built around
        </p>
        <p className="mt-1 text-sm font-semibold text-[#3d684f]">your campus, your sources</p>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden"
      id="home"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full border border-[#e5ebe2] sm:-right-20"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-[360px] rounded-full border border-[#e5ebe2]"
      />
      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 pb-24 pt-12 sm:px-8 sm:pb-28 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:px-12 lg:pb-32 lg:pt-20">
        <div className="relative z-10 max-w-[600px]">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#dce6da] bg-white/70 px-3.5 py-1.5 text-xs font-semibold tracking-[0.01em] text-[#456b53]">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-[#6d9b73]" />
            A new idea for campus life
          </p>
          <h1
            className="mt-6 text-[clamp(2.75rem,6vw,5rem)] font-semibold leading-[1.04] tracking-[-0.065em] text-[#21362b]"
            id="hero-title"
          >
            Campus answers,
            <br />
            <span className="font-serif font-normal italic text-[#507c5d]">
              without the
            </span>
            <br />
            scavenger hunt.
          </h1>
          <p className="mt-6 max-w-[490px] text-base leading-7 text-[#647168] sm:text-lg sm:leading-8">
            CampusGPT is being built to make the information scattered across
            handbooks, calendars, and campus resources easier to find and
            understand.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#285c49] px-6 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(40,92,73,0.8)] transition hover:bg-[#214c3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49]"
              href="#how-it-works"
            >
              Discover the idea
              <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" className="size-4">
                <path
                  d="M4.5 10h11m-4.5-4.5L15.5 10 11 14.5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </a>
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-semibold text-[#486153] transition hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49]"
              href="#designed-for-campus"
            >
              What it could help with
            </a>
          </div>
        </div>
        <div className="relative z-10 lg:pl-3">
          <DocumentPreview />
        </div>
      </div>
    </section>
  );
}

function ProductDirection() {
  return (
    <section
      aria-labelledby="direction-title"
      className="bg-white py-20 sm:py-24"
      id="how-it-works"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6c8c72]">
              The direction
            </p>
            <h2
              className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.05em] text-[#25382d] sm:text-4xl"
              id="direction-title"
            >
              Less searching.
              <br />
              More getting on with it.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#68746c]">
              Campus information should be useful, understandable, and grounded
              in the resources your college already provides.
            </p>
          </div>
          <ol className="divide-y divide-[#e9ede7]">
            {productPrinciples.map((principle) => (
              <li
                className="grid gap-2 py-5 first:pt-0 last:pb-0 sm:grid-cols-[3rem_1fr] sm:gap-4"
                key={principle.number}
              >
                <span className="pt-1 text-xs font-semibold tracking-[0.08em] text-[#8aa18b]">
                  {principle.number}
                </span>
                <div>
                  <h3 className="text-lg font-semibold tracking-[-0.025em] text-[#304338]">
                    {principle.title}
                  </h3>
                  <p className="mt-1.5 max-w-xl text-sm leading-6 text-[#707b73]">
                    {principle.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function CampusUseCases() {
  return (
    <section
      aria-labelledby="use-cases-title"
      className="py-20 sm:py-24"
      id="designed-for-campus"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6c8c72]">
            Made for the everyday questions
          </p>
          <h2
            className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[#25382d] sm:text-4xl"
            id="use-cases-title"
          >
            College life has enough going on.
          </h2>
          <p className="mt-4 text-base leading-7 text-[#68746c]">
            The goal is to make the answers in campus resources easier to get to
            — from the first week to finals.
          </p>
        </div>
        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          <li className="rounded-2xl border border-[#e6eae3] bg-white/70 p-6">
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-xl bg-[#eaf4ed] text-[#4f8564]"
            >
              <svg fill="none" viewBox="0 0 24 24" className="size-5">
                <path
                  d="M5 5.75h14v12.5H5zM8 9.25h8m-8 3h8m-8 3h5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </span>
            <h3 className="mt-5 font-semibold text-[#304338]">Policies &amp; handbooks</h3>
            <p className="mt-2 text-sm leading-6 text-[#707b73]">
              Spend less time hunting through long documents for the details
              that matter.
            </p>
          </li>
          <li className="rounded-2xl border border-[#e6eae3] bg-white/70 p-6">
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-xl bg-[#f0edfa] text-[#7465a7]"
            >
              <svg fill="none" viewBox="0 0 24 24" className="size-5">
                <rect
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  width="14"
                  x="5"
                  y="6.5"
                />
                <path
                  d="M8.5 4.75v3.5m7-3.5v3.5m-10.5 2h14m-10 3h2m3 0h2"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.5"
                />
              </svg>
            </span>
            <h3 className="mt-5 font-semibold text-[#304338]">Dates &amp; deadlines</h3>
            <p className="mt-2 text-sm leading-6 text-[#707b73]">
              Keep the important dates and academic guidance closer at hand.
            </p>
          </li>
          <li className="rounded-2xl border border-[#e6eae3] bg-white/70 p-6">
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-xl bg-[#fbf0e7] text-[#b47a4e]"
            >
              <svg fill="none" viewBox="0 0 24 24" className="size-5">
                <path
                  d="M19 10.25c0 5-7 10-7 10s-7-5-7-10a7 7 0 1 1 14 0Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle cx="12" cy="10.25" r="2.25" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            <h3 className="mt-5 font-semibold text-[#304338]">Campus services</h3>
            <p className="mt-2 text-sm leading-6 text-[#707b73]">
              Find the right place to start when you need help or student
              support.
            </p>
          </li>
        </ul>
        <p className="mt-5 text-center text-xs leading-5 text-[#808981]">
          These are examples of the kinds of campus information CampusGPT aims
          to support.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#e5eae2] bg-[#f7f8f4]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <BrandMark />
        <p className="text-xs leading-5 text-[#7b857d]">
          An early-stage project for making campus knowledge easier to find.
        </p>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <>
      <a
        className="sr-only z-50 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#285c49] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-2 focus:outline-offset-2 focus:outline-[#285c49]"
        href="#main-content"
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content">
        <Hero />
        <ProductDirection />
        <CampusUseCases />
      </main>
      <Footer />
    </>
  );
}
