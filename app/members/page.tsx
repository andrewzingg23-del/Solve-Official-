import type { Metadata } from "next";
import Link from "next/link";
import styles from "./members.module.css";

export const metadata: Metadata = {
  title: "Members Only — Work independently. Build together.",
  description: "A private community taking shape around shared work, fitness, travel, experiences, and the people who make it worthwhile. Powered by SOLVE.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Members Only — A life worth building together.",
    description: "Private community. Shared work. Real people. New places. The founding circle is taking shape.",
    type: "website",
  },
};

const pillars = [
  { number: "01", title: "Work", label: "The freedom to do your own thing.", description: "Your business. Your projects. Your terms. Collaborate when the right people and opportunities meet." },
  { number: "02", title: "Train", label: "Keep good company.", description: "Make time to get stronger with people who bring out the best in each other." },
  { number: "03", title: "Gather", label: "The stories happen together.", description: "Dinners, celebrations, music, and weekends that are worth showing up for." },
  { number: "04", title: "Go", label: "Take your world with you.", description: "A vision for local circles, work trips, and eventually trusted nodes wherever life takes you." },
] as const;

export default function MembersOnlyPage() {
  return (
    <main className={styles.site} id="top">
      <a href="#main" className={styles.skip}>Skip to content</a>
      <header className={styles.header}>
        <Link href="/members" className={styles.mark} aria-label="Members Only home"><span>MEMBERS</span><span>ONLY<span className={styles.dot}>.</span>OS</span></Link>
        <nav className={styles.nav} aria-label="Members Only">
          <a href="#experience">The experience</a>
          <a href="#foundation">The foundation</a>
          <a href="#founding">Founding circle</a>
        </nav>
        <a className={styles.headerCta} href="#founding">Get introduced <span aria-hidden="true">↗</span></a>
      </header>

      <div id="main">
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroTop}><span>PRIVATE BY DESIGN · OPEN TO WHAT&apos;S POSSIBLE</span><span>FOUNDING CHAPTER / FLORIDA</span></div>
          <div className={styles.heroText}>
            <span className={styles.eyebrow}>A new kind of circle</span>
            <h1 id="hero-heading">Your own life.<br /><em>Better together.</em></h1>
            <p>Work independently. Build with good people. Train, travel, celebrate, and find your place in something bigger than a job.</p>
            <div className={styles.actions}>
              <a className={styles.primary} href="#founding">Meet the founding circle <span aria-hidden="true">↗</span></a>
              <a className={styles.secondary} href="#experience">Explore the idea <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <div className={styles.heroBottom}><span>PEOPLE / PLACES / POSSIBILITY</span><span>SCROLL TO EXPLORE &nbsp; ↓</span></div>
          <div className={styles.heroContour} aria-hidden="true"><span>M</span><span>O</span></div>
        </section>

        <section className={styles.manifesto} aria-labelledby="manifesto-heading">
          <p className={styles.eyebrow}>Not another coworking membership</p>
          <h2 id="manifesto-heading">The best part of building a life<br />is <em>who you build it with.</em></h2>
          <p>Most people have to choose between independence and belonging. We think you should have both. Members Only is being built for people who want room to pursue their own ambitions—and a circle worth coming back to.</p>
        </section>

        <section className={styles.experience} id="experience" aria-labelledby="experience-heading">
          <div className={styles.sectionTop}><span className={styles.eyebrow}>THE EXPERIENCE</span><h2 id="experience-heading">A full life.<br /><em>Not a single lane.</em></h2></div>
          <div className={styles.pillars}>
            {pillars.map(item => <article key={item.number} className={styles.pillar}>
              <div className={styles.pillarMeta}><span>{item.number}</span><span aria-hidden="true">↗</span></div>
              <h3>{item.title}</h3><strong>{item.label}</strong><p>{item.description}</p>
            </article>)}
          </div>
        </section>

        <section className={styles.story} aria-labelledby="story-heading">
          <span className={styles.eyebrow}>THE FIRST CHAPTER</span>
          <h2 id="story-heading">A good morning.<br />A productive day.<br /><em>An unforgettable night.</em></h2>
          <p>Meet up. Get some work done. Make introductions. Train. Have dinner. Throw the party. Do it again somewhere new. It starts with real people and repeatable experiences—not with a promise of hundreds of locations.</p>
          <div className={styles.storyFooter}><span>01 / LOCAL CIRCLE</span><span>02 / SHARED TRIPS</span><span>03 / GLOBAL NODES</span></div>
        </section>

        <section className={styles.foundation} id="foundation" aria-labelledby="foundation-heading">
          <div><span className={styles.eyebrow}>THE DIGITAL FOUNDATION</span><h2 id="foundation-heading">The circle is human.<br /><em>The system is SOLVE.</em></h2></div>
          <div className={styles.foundationRight}>
            <p>SOLVE is the shared workspace behind the vision: personal identity, private communities, projects, and AI-enabled coordination. The goal is simple—your people and your work should remain connected as life moves between places.</p>
            <Link href="/" className={styles.outlineLink}>Explore the SOLVE workspace <span aria-hidden="true">↗</span></Link>
            <span className={styles.caveat}>SOLVE features are being developed. Physical node access and global membership are future ambitions, not current benefits.</span>
          </div>
        </section>

        <section className={styles.founding} id="founding" aria-labelledby="founding-heading">
          <div className={styles.foundingInner}>
            <span className={styles.eyebrow}>FOUNDING CIRCLE · EARLY INTEREST</span>
            <h2 id="founding-heading">Good people.<br /><em>At the beginning.</em></h2>
            <p>We&apos;re connecting independently minded builders, creatives, operators, and people who know how to have a good time. The first step is a conversation—not a purchase or a promise of access.</p>
            <div className={styles.foundingActions}>
              <a className={styles.primary} href="https://www.instagram.com/membersonly.os/" target="_blank" rel="noopener noreferrer">Introduce yourself on Instagram <span aria-hidden="true">↗</span></a>
              <Link href="/login?next=%2Faccount" className={styles.secondary}>Already building? Open SOLVE <span aria-hidden="true">→</span></Link>
            </div>
            <p className={styles.introNote}>Message <strong>@membersonly.os</strong> with your city, what you&apos;re building, and what kind of people you want to meet. No paid memberships are offered on this page.</p>
          </div>
        </section>
      </div>

      <footer className={styles.footer}>
        <Link href="/members" className={styles.footerMark}>MEMBERS ONLY<span>.</span>OS</Link>
        <p>Built around people. Made for real life.</p>
        <div><a href="https://www.instagram.com/membersonly.os/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><Link href="/">SOLVE ↗</Link><a href="#top">Back to top ↑</a></div>
      </footer>
    </main>
  );
}
