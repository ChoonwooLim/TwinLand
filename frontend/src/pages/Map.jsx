import { useTranslation } from 'react-i18next';
import styles from './Map.module.css';

export default function MapPage() {
  const { t } = useTranslation();

  return (
    <section className={styles.mapHost}>
      <iframe
        src="/legacy-map/index.html"
        title={t('map.title')}
        className={styles.mapFrame}
        loading="eager"
        allow="geolocation; xr-spatial-tracking"
      />
    </section>
  );
}
