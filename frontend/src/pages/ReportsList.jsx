/* 내 보고서 목록 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import styles from './ReportsList.module.css';

export default function ReportsList() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/reports')
      .then((r) => setReports(r.data))
      .catch((e) => setError(e?.response?.data?.detail || '목록 로드 실패'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>내 보고서</h1>
          <p className={styles.muted}>{reports.length} 건</p>
        </div>
        <Link to="/reports/new" className={styles.btnPrimary}>+ 새 보고서</Link>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.empty}>로딩 중...</div>}

      {!loading && reports.length === 0 && (
        <div className={styles.empty}>
          <p>아직 생성한 보고서가 없습니다.</p>
          <Link to="/reports/new" className={styles.btnPrimary}>첫 보고서 만들기</Link>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div className={styles.grid}>
          {reports.map((r) => (
            <Link key={r.id} to={`/reports/${r.id}`} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={`${styles.badge} ${styles[`status_${r.status}`] || ''}`}>{r.status}</span>
                {r.has_pdf && <span className={styles.badgePdf}>PDF</span>}
              </div>
              <h3 className={styles.cardTitle}>{r.title}</h3>
              <p className={styles.cardSummary}>{r.summary || '—'}</p>
              <div className={styles.cardMeta}>
                <span>필지 {r.parcel_count}건</span>
                <span>{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
