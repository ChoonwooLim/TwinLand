// JooJoo Land - 필지 편집 모달
// 동/리, 지번, 지목, 면적, 소유자 편집 → localStorage 저장 → 페이지 재로드

(function () {
  const CATEGORIES = ['전', '답', '임', '임야', '대', '대지', '도로', '하천', '구거', '유지', '잡', '기타'];

  const modal = document.getElementById('editor-modal');
  const tbody = document.getElementById('editor-tbody');
  const prefixInput = document.getElementById('editor-prefix');
  const fileInput = document.getElementById('editor-file-input');

  let rows = [];   // working copy

  function open() {
    rows = (window.PARCELS || []).map(p => ({ ...p }));
    prefixInput.value = window.ADDRESS_PREFIX || window.DEFAULT_ADDRESS_PREFIX || '';
    render();
    modal.classList.remove('hidden');
  }

  function close() {
    modal.classList.add('hidden');
  }

  function render() {
    tbody.innerHTML = '';
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="number" class="ed-no" value="${r.no ?? i + 1}" /></td>
        <td><input type="text" class="ed-location" value="${escape(r.location ?? '')}" placeholder="예: 금왕리" /></td>
        <td><input type="text" class="ed-lot" value="${escape(r.lot ?? '')}" placeholder="예: 469 또는 산205-3" /></td>
        <td>
          <select class="ed-category">
            ${CATEGORIES.map(c => `<option value="${c}" ${c === r.category ? 'selected' : ''}>${c}</option>`).join('')}
            ${r.category && !CATEGORIES.includes(r.category) ? `<option value="${r.category}" selected>${escape(r.category)}</option>` : ''}
          </select>
        </td>
        <td><input type="number" class="ed-area-m2" value="${r.area_m2 ?? 0}" min="0" /></td>
        <td><input type="number" class="ed-area-pyeong" value="${r.area_pyeong ?? Math.round((r.area_m2 || 0) * 0.3025)}" min="0" /></td>
        <td><input type="text" class="ed-owner" value="${escape(r.owner ?? '')}" /></td>
        <td><input type="text" class="ed-memo" value="${escape(r.memo ?? '')}" /></td>
        <td><button class="ed-delete" title="삭제">✕</button></td>
      `;
      // 면적 m² 바뀌면 평 자동 계산
      const m2 = tr.querySelector('.ed-area-m2');
      const py = tr.querySelector('.ed-area-pyeong');
      m2.addEventListener('input', () => { py.value = Math.round(parseFloat(m2.value || 0) * 0.3025); });
      tr.querySelector('.ed-delete').addEventListener('click', () => {
        rows.splice(i, 1);
        render();
      });
      tbody.appendChild(tr);
    });
  }

  function collect() {
    return Array.from(tbody.querySelectorAll('tr')).map(tr => ({
      no:           parseInt(tr.querySelector('.ed-no').value, 10) || 0,
      location:     tr.querySelector('.ed-location').value.trim(),
      lot:          tr.querySelector('.ed-lot').value.trim(),
      category:     tr.querySelector('.ed-category').value,
      area_m2:      parseFloat(tr.querySelector('.ed-area-m2').value) || 0,
      area_pyeong:  parseFloat(tr.querySelector('.ed-area-pyeong').value) || 0,
      owner:        tr.querySelector('.ed-owner').value.trim(),
      memo:         tr.querySelector('.ed-memo').value.trim(),
    })).filter(r => r.lot);
  }

  function escape(s) {
    return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // ===== 이벤트 =====
  document.getElementById('open-editor').addEventListener('click', open);
  document.getElementById('editor-close').addEventListener('click', close);
  document.getElementById('editor-cancel').addEventListener('click', close);

  document.getElementById('editor-add-row').addEventListener('click', () => {
    rows.push({
      no: (rows.at(-1)?.no || 0) + 1,
      location: rows.at(-1)?.location || '',
      lot: '', category: '전', area_m2: 0, area_pyeong: 0, owner: '', memo: '',
    });
    render();
    tbody.lastElementChild?.querySelector('.ed-lot')?.focus();
  });

  document.getElementById('editor-save').addEventListener('click', () => {
    const updated = collect();
    if (updated.length === 0) {
      alert('최소 1개 필지가 필요합니다');
      return;
    }
    const prefix = prefixInput.value.trim() || window.DEFAULT_ADDRESS_PREFIX;
    window.saveCustomParcels(updated, prefix);
    location.reload();
  });

  document.getElementById('editor-reset').addEventListener('click', () => {
    if (!confirm('기본 34필지 (양평 금왕리)로 복원합니다. 커스텀 데이터는 삭제돼요. 계속?')) return;
    window.resetParcelsToDefault();
    location.reload();
  });

  document.getElementById('editor-export').addEventListener('click', () => {
    const data = { prefix: prefixInput.value.trim(), parcels: collect() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `parcels-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  });

  document.getElementById('editor-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : data.parcels;
      if (!Array.isArray(arr)) throw new Error('JSON 형식 오류: parcels 배열이 없음');
      rows = arr;
      if (data.prefix) prefixInput.value = data.prefix;
      render();
      alert(`${arr.length}개 필지 불러옴 — 확인 후 저장 버튼 눌러주세요`);
    } catch (err) {
      alert('가져오기 실패: ' + err.message);
    }
    fileInput.value = '';
  });

  // 배경 클릭으로 닫기
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
})();
