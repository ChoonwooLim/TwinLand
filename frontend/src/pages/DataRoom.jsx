import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SectionTitle from '../components/common/SectionTitle.jsx';
import { api } from '../lib/api.js';
import { formatBytes, formatDateTime } from '../lib/format.js';
import styles from './DataRoom.module.css';

export default function DataRoom() {
  const { t } = useTranslation();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/dataroom').then((r) => setDocs(r.data.items)).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <SectionTitle
            eyebrow="Data Room"
            title={t('dataroom.title')}
            subtitle={t('dataroom.subtitle')}
            align="center"
            invert
          />
        </div>
      </section>

      <section className={`section ${styles.content}`}>
        <div className="container">
          <div className={styles.docList}>
            <div className={styles.docListHeader}>
              <span>문서</span>
              <span>형식</span>
              <span>크기</span>
              <span></span>
            </div>
            {loading ? (
              <div className={styles.docRow}><div className={styles.docTitle}>불러오는 중…</div></div>
            ) : docs.length === 0 ? (
              <div className={styles.docRow}><div className={styles.docTitle}>등록된 문서가 없습니다.</div></div>
            ) : (
              docs.map((doc) => (
                <div key={doc.id} className={styles.docRow}>
                  <div className={styles.docTitle}>
                    {doc.title}
                    {doc.description && <span className={styles.docDesc}> — {doc.description}</span>}
                    <div style={{ fontSize: 11, opacity: 0.5 }}>업데이트 {formatDateTime(doc.updated_at)}</div>
                  </div>
                  <div className={styles.docMeta}>{doc.file_type?.toUpperCase()}</div>
                  <div className={styles.docMeta}>{formatBytes(doc.size_bytes)}</div>
                  <div className={styles.docAction}>
                    <a
                      className={styles.docBtn}
                      href={`/api/dataroom/${doc.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      다운로드 →
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}
