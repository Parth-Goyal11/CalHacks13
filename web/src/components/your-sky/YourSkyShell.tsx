import Link from "next/link";
import type { ReactNode } from "react";
import { SkyIcon } from "./SkyIcon";
import styles from "./YourSky.module.css";

export function CaptureLink() {
  return <Link className={styles.primary} href="/upload"><SkyIcon name="camera" /><span>Capture</span><SkyIcon name="arrow" /></Link>;
}

export default function YourSkyShell({ active, children }: { active: "tonight" | "events" | "capture" | "my-sky"; children: ReactNode }) {
  return <div className={styles.root}>
    <div className={styles.shell}>
      <a className={styles.skip} href="#your-sky-main">Skip to content</a>
      <header className={styles.header}>
        <Link className={styles.wordmark} href="/" aria-label="Your Sky home"><SkyIcon name="mark" /><span>Your Sky</span></Link>
      </header>
      <main id="your-sky-main" tabIndex={-1} className={styles.main}>{children}</main>
    </div>
    <nav className={styles.navigation} aria-label="Main navigation">
      <div className={styles.navigationInner}>
        <Link className={styles.navLink} href="/" aria-current={active === "tonight" ? "page" : undefined}><SkyIcon name="moon" /><span>Tonight</span></Link>
        <Link className={styles.navLink} href="/events" aria-current={active === "events" ? "page" : undefined}><SkyIcon name="star" /><span>Events</span></Link>
        <Link className={`${styles.navLink} ${styles.navCapture}`} href="/upload" aria-current={active === "capture" ? "page" : undefined}><SkyIcon name="camera" /><span>Capture</span></Link>
        <Link className={styles.navLink} href="/my-sky" aria-current={active === "my-sky" ? "page" : undefined}><SkyIcon name="collection" /><span>My Sky</span></Link>
      </div>
    </nav>
  </div>;
}
