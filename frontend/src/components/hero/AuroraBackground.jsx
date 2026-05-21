import styles from './AuroraBackground.module.css';

export default function AuroraBackground({ intensity = 1, image = true }) {
  return (
    <div className={styles.wrap} style={{ opacity: intensity }} aria-hidden>
      {image && <div className={styles.photo} />}
      {image && <div className={styles.photoVeil} />}
      <div className={`${styles.blob} ${styles.blob1}`} />
      <div className={`${styles.blob} ${styles.blob2}`} />
      <div className={`${styles.blob} ${styles.blob3}`} />
      <div className={styles.grid} />
    </div>
  );
}
