import { useTranslation } from 'react-i18next';
import styles from './Footer.module.css';

export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>◐</span>
            <span>JooJooLand</span>
          </div>
          <p className={styles.tagline}>{t('footer.tagline')}</p>
        </div>

        <div className={styles.contact}>
          <div className={styles.contactLabel}>Founder · IP Holder · All Inquiries</div>
          <div className={styles.name}>Steven Lim</div>
          <a className={styles.link} href="mailto:choonwoo49@gmail.com">choonwoo49@gmail.com</a>
          <a className={styles.link} href="tel:+821041736570">+82 10-4173-6570</a>
        </div>

        <div className={styles.legal}>
          <div>© {year} Pet Twinverse · JooJooLand</div>
          <div className={styles.legalSmall}>
            All rights, licenses, and intellectual property reserved by Steven Lim.
          </div>
        </div>
      </div>
    </footer>
  );
}
