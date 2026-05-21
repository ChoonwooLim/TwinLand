import { useTranslation } from 'react-i18next';
import SectionTitle from '../components/common/SectionTitle.jsx';
import AuroraBackground from '../components/hero/AuroraBackground.jsx';
import styles from './Vision.module.css';

const PILLARS = ['pillar1', 'pillar2', 'pillar3', 'pillar4'];

export default function Vision() {
  const { t } = useTranslation();

  return (
    <>
      <section className={styles.hero}>
        <AuroraBackground intensity={0.7} />
        <div className={styles.heroInner}>
          <SectionTitle
            eyebrow="Vision"
            title={t('vision.title')}
            subtitle={t('vision.subtitle')}
            align="center"
            invert
          />
        </div>
      </section>

      <section className={`section ${styles.pillars}`}>
        <div className="container">
          {PILLARS.map((p, idx) => (
            <article key={p} className={`${styles.pillar} ${idx % 2 === 1 ? styles.pillarReverse : ''}`}>
              <div className={styles.pillarNumber}>{String(idx + 1).padStart(2, '0')}</div>
              <div className={styles.pillarBody}>
                <h3 className={styles.pillarTitle}>{t(`vision.${p}.title`)}</h3>
                <p className={styles.pillarText}>{t(`vision.${p}.body`)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
