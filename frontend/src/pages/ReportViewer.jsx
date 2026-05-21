/* 보고서 뷰어 — 백엔드의 렌더된 HTML 을 iframe 으로 표시 + 다운로드/공유 액션 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import styles from './ReportViewer.module.css';

export default function ReportViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get(`/api/reports/${id}`)
      .then((r) => setReport(r.data))
      .catch((e) => setError(e?.response?.data?.detail || '보고서 로드 실패'));
  }, [id]);

  const copyShareUrl = () => {
    if (!report) return;
    const url = `${window.location.origin}/api/reports/share/${report.share_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const remove = async () => {
    if (!confirm('이 보고서를 삭제할까요?')) return;
    try {
      await api.delete(`/api/reports/${id}`);
      navigate('/reports');
    } catch (e) {
      setError(e?.response?.data?.detail || '삭제 실패');
    }
  };

  if (error) return <div className={styles.error}>⚠ {error}</div>;
  if (!report) return <div className={styles.loading}>로딩 중...</div>;

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>{report.title}</h1>
          <p className={styles.meta}>
            {report.summary || '—'} · 필지 {report.parcel_count}건 · 생성 {new Date(report.created_at).toLocaleString('ko-KR')}
            {report.generation_ms ? ` · ${(report.generation_ms / 1000).toFixed(1)}s` : ''}
          </p>
        </div>
        <div className={styles.actions}>
          {report.has_pdf && (
            <a href={`/api/reports/${report.id}/pdf`} className={styles.btn} target="_blank" rel="noopener noreferrer">
              📄 PDF 다운로드
            </a>
          )}
          <button type="button" className={styles.btn} onClick={copyShareUrl}>
            {copied ? '✓ 복사됨' : '🔗 공유 URL 복사'}
          </button>
          <button type="button" className={styles.btnDanger} onClick={remove}>삭제</button>
        </div>
      </header>

      <iframe
        title={report.title}
        className={styles.frame}
        src={`/api/reports/${report.id}/html`}
      />
    </div>
  );
}
