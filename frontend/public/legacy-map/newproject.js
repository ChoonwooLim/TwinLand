// TwinLand - 새 프로젝트 만들기 모달
// 이름 + (선택) 이미지/PDF/엑셀/CSV 업로드 → 동/리·지번 자동 추출 → 프로젝트 생성·전환.
// 지목·면적은 생성 후 편집기의 "🔍 전체 자동"(VWorld)으로 채운다.

// 공용 추출 업로더 — 이미지/스캔PDF 는 백엔드가 202+job_id 를 주므로 폴링한다
// (비전 ~1-3분이 프록시 타임아웃을 넘기지 않도록). editor.js 도 이 함수를 쓴다.
// onStatus(elapsedSeconds, phase) 로 진행상황 콜백. 반환: {prefix, parcels, source, warnings}
window.TwinLandExtract = async function (file, onStatus) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/ai/extract-parcels', { method: 'POST', body: fd });
  if (!res.ok && res.status !== 202) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || `HTTP ${res.status}`);
  }
  let data = await res.json();
  if (data && data.job_id) {
    const started = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise((r) => setTimeout(r, 3000));
      const elapsed = Math.round((Date.now() - started) / 1000);
      if (onStatus) onStatus(elapsed, 'polling');
      let pd;
      try {
        const pr = await fetch(`/api/ai/extract-parcels/jobs/${data.job_id}`);
        if (!pr.ok) throw new Error(`상태 조회 HTTP ${pr.status}`);
        pd = await pr.json();
      } catch (e) {
        // 일시적 네트워크 흔들림은 계속 폴링(타임아웃 한도 내)
        if (elapsed > 360) throw e;
        continue;
      }
      if (pd.status === 'done') { data = pd; break; }
      if (pd.status === 'error') throw new Error(pd.detail || 'AI 추출 실패');
      if (elapsed > 360) throw new Error('시간 초과 (6분) — 잠시 후 다시 시도하세요');
    }
  }
  return data;
};

(function () {
  const modal = document.getElementById('newproject-modal');
  if (!modal) return;

  const nameInput = document.getElementById('np-name');
  const prefixInput = document.getElementById('np-prefix');
  const dropzone = document.getElementById('np-dropzone');
  const fileInput = document.getElementById('np-file');
  const pickBtn = document.getElementById('np-pick');
  const statusEl = document.getElementById('np-status');
  const previewEl = document.getElementById('np-preview');
  const createBtn = document.getElementById('np-create');
  const createBlankBtn = document.getElementById('np-create-blank');

  let extracted = [];   // [{location, lot}]

  function open() {
    nameInput.value = '';
    prefixInput.value = '';
    prefixInput.placeholder = window.DEFAULT_ADDRESS_PREFIX || '경기도 여주시 북내면';
    resetExtraction();
    modal.classList.remove('hidden');
    setTimeout(() => nameInput.focus(), 50);
  }
  function close() { modal.classList.add('hidden'); }

  function resetExtraction() {
    extracted = [];
    statusEl.className = 'np-status hidden';
    statusEl.textContent = '';
    previewEl.className = 'np-preview hidden';
    previewEl.innerHTML = '';
    fileInput.value = '';
    updateCreateLabel();
  }

  function updateCreateLabel() {
    createBtn.textContent = extracted.length ? `만들기 (${extracted.length}필지)` : '만들기';
    createBtn.disabled = false;   // 이름만 있으면 빈 프로젝트도 생성 가능
  }

  function setStatus(kind, msg) {
    statusEl.className = `np-status np-status-${kind}`;
    statusEl.textContent = msg;
  }

  function renderPreview(rows) {
    if (!rows.length) { previewEl.className = 'np-preview hidden'; previewEl.innerHTML = ''; return; }
    const max = 12;
    const items = rows.slice(0, max).map(r =>
      `<li>${escapeHtml((r.location || '') + ' ' + r.lot)}</li>`
    ).join('');
    const more = rows.length > max ? `<li class="np-preview-more">… 외 ${rows.length - max}개</li>` : '';
    previewEl.innerHTML = items + more;
    previewEl.className = 'np-preview';
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function handleFile(file) {
    if (!file) return;
    resetExtraction();
    dropzone.classList.add('np-dz-loading');
    const isImage = /^image\//.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
    setStatus('loading', isImage ? `⏳ 이미지 분석 중… (AI 비전, 1~3분) — ${file.name}` : `⏳ 분석 중… — ${file.name}`);
    try {
      const data = await window.TwinLandExtract(file, (sec) => {
        setStatus('loading', `⏳ AI 비전 분석 중… ${sec}초 경과 (보통 1~3분) — ${file.name}`);
      });
      const rows = (data.parcels || []).filter(p => p && p.lot);
      if (data.prefix && !prefixInput.value.trim()) prefixInput.value = data.prefix;
      if (rows.length === 0) {
        setStatus('warn', '지번을 찾지 못했습니다.' + (data.warnings?.length ? ' ' + data.warnings.join(' ') : ''));
        return;
      }
      extracted = rows.map(p => ({ location: p.location || '', lot: p.lot }));
      const warn = data.warnings?.length ? ' ⚠ ' + data.warnings.join(' ') : '';
      setStatus('ok', `✅ ${extracted.length}개 지번 추출됨. "만들기"로 프로젝트 생성.${warn}`);
      renderPreview(extracted);
    } catch (err) {
      setStatus('error', '추출 실패: ' + err.message);
    } finally {
      dropzone.classList.remove('np-dz-loading');
      updateCreateLabel();
    }
  }

  function toFullParcels(list) {
    return list.map((p, i) => ({
      no: i + 1,
      location: p.location || '',
      lot: p.lot || '',
      category: '전',
      area_m2: 0,
      area_pyeong: 0,
      owner: '',
      memo: '',
    }));
  }

  function create(withParcels) {
    const name = (nameInput.value || '').trim();
    if (!name) { nameInput.focus(); alert('프로젝트 이름을 입력하세요'); return; }
    if (window.ProjectStore?.exists?.(name)) { nameInput.focus(); alert(`이미 있는 이름입니다: ${name}`); return; }
    const prefix = prefixInput.value.trim();
    const parcels = withParcels ? toFullParcels(extracted) : [];
    try {
      window.ProjectStore.create(name, prefix, parcels);   // 내부에서 reload
    } catch (e) {
      alert(e.message);
    }
  }

  // ===== 이벤트 =====
  document.getElementById('open-newproject')?.addEventListener('click', open);
  document.getElementById('newproject-close')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });

  pickBtn?.addEventListener('click', () => fileInput.click());
  dropzone?.addEventListener('click', (e) => { if (e.target === dropzone || e.target.classList.contains('np-dz-text') || e.target.classList.contains('np-dz-icon')) fileInput.click(); });
  dropzone?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  fileInput?.addEventListener('change', (e) => handleFile(e.target.files?.[0]));

  ['dragenter', 'dragover'].forEach(ev => dropzone?.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation(); dropzone.classList.add('np-dz-over');
  }));
  ['dragleave', 'drop'].forEach(ev => dropzone?.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('np-dz-over');
  }));
  dropzone?.addEventListener('drop', (e) => handleFile(e.dataTransfer?.files?.[0]));

  createBtn?.addEventListener('click', () => create(extracted.length > 0));
  createBlankBtn?.addEventListener('click', () => create(false));
  nameInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(extracted.length > 0); });
})();
