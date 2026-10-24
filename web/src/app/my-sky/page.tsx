import type { Metadata } from "next";
import YourSkyShell, { CaptureLink } from "@/components/your-sky/YourSkyShell";
import { SkyIcon } from "@/components/your-sky/SkyIcon";
import styles from "@/components/your-sky/YourSky.module.css";

export const metadata: Metadata = { title: "My Sky - Your Sky" };

export default function MySkyPage() {
  return <YourSkyShell active="my-sky">
    <div className={styles.pageHeading}><div><h1>My Sky</h1><p className={styles.date}>Your nights outside, kept together.</p></div></div>
    <section className={styles.emptyCollection} aria-labelledby="collection-title"><SkyIcon name="collection" /><h2 id="collection-title">Your first night starts here.</h2><p>Take a photo and get to know the sky above you.</p><CaptureLink /><p className={styles.exampleNote}>Collection preview. Saving discoveries comes next.</p></section>
  </YourSkyShell>;
}
