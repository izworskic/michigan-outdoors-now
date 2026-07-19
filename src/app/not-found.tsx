import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section className="not-found content-wrap">
      <p className="eyebrow">404 · Wrong trail</p>
      <h1>This route does not lead outside.</h1>
      <p>The page may have moved, or the address may be incomplete.</p>
      <Link className="primary-button" href="/"><span>Return to the planner</span><span aria-hidden="true">→</span></Link>
    </section>
  );
}
