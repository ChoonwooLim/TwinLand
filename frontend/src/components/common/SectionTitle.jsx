import styles from './SectionTitle.module.css';

export default function SectionTitle({ eyebrow, title, subtitle, align = 'left', invert = false }) {
  return (
    <header className={`${styles.wrap} ${styles[align]} ${invert ? styles.invert : ''}`}>
      {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
      <h2 className={styles.title}>{title}</h2>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </header>
  );
}
