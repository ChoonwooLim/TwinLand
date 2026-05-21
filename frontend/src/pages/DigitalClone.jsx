import { useTranslation } from 'react-i18next';
import SectionTitle from '../components/common/SectionTitle.jsx';
import CTAButton from '../components/common/CTAButton.jsx';
import styles from './DigitalClone.module.css';

const FEATURES = [
  { icon: '📈', key: 'growth' },
  { icon: '🧠', key: 'personality' },
  { icon: '📚', key: 'memory' },
  { icon: '✨', key: 'hologram' },
];

export default function DigitalClone() {
  const { t } = useTranslation();

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <SectionTitle
            eyebrow="Digital Clone"
            title={t('clone.title')}
            subtitle={t('clone.subtitle')}
            align="center"
            invert
          />
        </div>
      </section>

      <section className={`section ${styles.viewer}`}>
        <div className="container">
          <div className={styles.viewerPlaceholder}>
            <div className={styles.viewerOrb} />
            <p className={styles.viewerHint}>
              3D Clone Viewer — <code>react-three-fiber</code>
              <br />
              <small>Phase 3 에서 r3f 캔버스 + 샘플 펫 모델 마운트</small>
            </p>
          </div>
        </div>
      </section>

      <section className={`section ${styles.features}`}>
        <div className="container">
          <div className={styles.grid}>
            {FEATURES.map((f) => (
              <div key={f.key} className={styles.feature}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <div className={styles.featureTitle}>{t(`clone.${f.key}`)}</div>
              </div>
            ))}
          </div>
          <div className={styles.cta}>
            <CTAButton to="/demo" variant="primary">
              {t('cta.viewDemo')} →
            </CTAButton>
          </div>
        </div>
      </section>
    </>
  );
}
