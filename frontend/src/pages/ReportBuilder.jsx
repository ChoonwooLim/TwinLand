/* 보고서 생성 페이지 — 필지 입력 + PDF 업로드 + AI 합성 트리거 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import styles from './ReportBuilder.module.css';

const SAMPLE_PARCELS = [
  { no: 28, location: '상교리', lot: '384-18', category: '임야', area_m2: 85677, area_pyeong: 25917, owner: '주)경기녹화조경', memo: 'DATA/ 샘플 (8.57 ha)' },
  { no: 40, location: '상교리', lot: '산31',  category: '임야', area_m2: 41847, area_pyeong: 12659, owner: '주)경기녹화조경', memo: 'DATA/ 샘플 (4.18 ha)' },
];

const FILE_TYPES = ['필지분석', '산지정보', '토지이용', '경사도', '기타'];

export default function ReportBuilder() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [addressPrefix, setAddressPrefix] = useState('경기도 여주시 북내면');
  const [parcels, setParcels] = useState(SAMPLE_PARCELS);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');

  // 필지 직접 편집 (간이)
  const addEmptyParcel = () => {
    setParcels((arr) => [...arr, { no: arr.length + 1, location: '상교리', lot: '', category: '임야', area_m2: 0, area_pyeong: 0, owner: '', memo: '' }]);
  };
  const updateParcel = (idx, field, value) => {
    setParcels((arr) => arr.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };
  const removeParcel = (idx) => {
    setParcels((arr) => arr.filter((_, i) => i !== idx));
  };

  // PDF 업로드
  const handleUpload = async (file, fileType) => {
    const form = new FormData();
    form.append('file', file);
    form.append('file_type', fileType || '기타');
    setUploading(true);
    setError('');
    try {
      const { data } = await api.post('/api/reports/attachments', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAttachments((arr) => [...arr, data]);
    } catch (e) {
      setError(e?.response?.data?.detail || '업로드 실패');
    } finally {
      setUploading(false);
    }
  };

  // 보고서 빌드
  const submit = async () => {
    setError('');
    if (!parcels.length) { setError('필지를 1개 이상 추가하세요'); return; }
    setBuilding(true);
    try {
      const payload = {
        title: title || null,
        parcels: parcels.map((p) => ({
          ...p,
          address: `${addressPrefix} ${p.location} ${p.lot}`.trim(),
        })),
        attachment_ids: attachments.map((a) => a.id),
      };
      const { data } = await api.post('/api/reports/build', payload);
      navigate(`/reports/${data.id}`);
    } catch (e) {
      setError(e?.response?.data?.detail || '보고서 빌드 실패');
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>새 보고서 생성</h1>
        <p className={styles.lead}>
          필지를 입력하거나 샘플 (상교리 384-18 + 산31) 그대로 사용. PDF 첨부 시 AI 가 본문 컨텍스트로 흡수합니다.
          빌드는 30 초 안에 완료됩니다.
        </p>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {/* 1. 제목 + 주소 */}
      <section className={styles.section}>
        <h2>1. 기본 정보</h2>
        <div className={styles.row}>
          <label>
            보고서 제목 <span className={styles.muted}>(비우면 AI 가 자동 생성)</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 여주시 북내면 상교리 종합 분석"
            />
          </label>
          <label>
            주소 prefix
            <input
              type="text"
              value={addressPrefix}
              onChange={(e) => setAddressPrefix(e.target.value)}
            />
          </label>
        </div>
      </section>

      {/* 2. 필지 입력 */}
      <section className={styles.section}>
        <h2>2. 필지</h2>
        <table className={styles.parcelsTable}>
          <thead>
            <tr><th>#</th><th>동/리</th><th>지번</th><th>지목</th><th>면적(m²)</th><th>소유자</th><th>비고</th><th></th></tr>
          </thead>
          <tbody>
            {parcels.map((p, i) => (
              <tr key={i}>
                <td>{p.no || i + 1}</td>
                <td><input value={p.location} onChange={(e) => updateParcel(i, 'location', e.target.value)} /></td>
                <td><input value={p.lot} onChange={(e) => updateParcel(i, 'lot', e.target.value)} placeholder="384-18 / 산31" /></td>
                <td><input value={p.category} onChange={(e) => updateParcel(i, 'category', e.target.value)} style={{ width: 70 }} /></td>
                <td><input type="number" value={p.area_m2} onChange={(e) => updateParcel(i, 'area_m2', +e.target.value)} style={{ width: 100 }} /></td>
                <td><input value={p.owner || ''} onChange={(e) => updateParcel(i, 'owner', e.target.value)} /></td>
                <td><input value={p.memo || ''} onChange={(e) => updateParcel(i, 'memo', e.target.value)} /></td>
                <td><button type="button" className={styles.btnDel} onClick={() => removeParcel(i)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className={styles.btnAdd} onClick={addEmptyParcel}>+ 필지 추가</button>
      </section>

      {/* 3. PDF 업로드 */}
      <section className={styles.section}>
        <h2>3. PDF 첨부 <span className={styles.muted}>(선택)</span></h2>
        <p className={styles.muted}>
          기존 필지분석결과서 · 산지정보조회 · 토지이용계획 PDF 를 첨부하면 AI 가 본문에서 발췌해 보고서에 통합합니다.
        </p>
        <div className={styles.uploadRow}>
          <input
            type="file"
            accept="application/pdf"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              // 파일명 기반 자동 분류
              let cls = '기타';
              for (const t of FILE_TYPES) if (f.name.includes(t)) { cls = t; break; }
              handleUpload(f, cls);
              e.target.value = '';
            }}
          />
          {uploading && <span className={styles.muted}>업로드 중...</span>}
        </div>
        {attachments.length > 0 && (
          <ul className={styles.attList}>
            {attachments.map((a) => (
              <li key={a.id}>
                <span className={styles.attBadge}>{a.file_type}</span>
                <span className={styles.attName}>{a.original_name}</span>
                <span className={styles.muted}>{(a.file_size / 1024).toFixed(0)} KB · {a.has_extracted_text ? '텍스트 추출 OK' : '텍스트 추출 실패 (스캔 PDF?)'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 빌드 */}
      <section className={styles.actions}>
        <button type="button" className={styles.btnPrimary} onClick={submit} disabled={building}>
          {building ? '빌드 중... (최대 60초)' : '보고서 빌드'}
        </button>
        {building && <p className={styles.muted}>OpenClaw 게이트웨이 호출 중 — 잠시만 기다려주세요.</p>}
      </section>
    </div>
  );
}
