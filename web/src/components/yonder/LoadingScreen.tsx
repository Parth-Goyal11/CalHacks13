import Image from "next/image";
import styles from "./LoadingScreen.module.css";

export default function LoadingScreen() {
  return (
    <div className={styles.screen} role="status" aria-label="Loading Yonder">
      <div className={styles.brand} aria-hidden="true">
        <Image
          src="/yonder-logo.jpg"
          alt=""
          width={80}
          height={80}
          priority
          className={styles.logo}
        />
        <p className={styles.name}>Yonder</p>
      </div>
    </div>
  );
}
