// TwinLand - 필지 편집 모달
// 동/리, 지번, 지목, 면적, 소유자 편집 → localStorage 저장 → 페이지 재로드
// 🔍 자동 채우기: 지번 입력 후 클릭 → VWorld 지오코딩 + WFS 로 지목·면적 자동 수집

(function () {
  const CATEGORIES = ['전', '답', '임', '임야', '대', '대지', '도로', '하천', '구거', '유지', '잡', '기타', '유원지'];

  // VWorld WFS 지목 코드 → 한글 매핑 (KLIS 28종 중 자주 쓰는 것)
  const JIMOK_CODE_MAP = {
    '01': '전', '02': '답', '03': '과수원', '04': '목장용지', '05': '임야',
    '06': '광천지', '07': '염전', '08': '대', '09': '공장용지', '10': '학교용지',
    '11': '주차장', '12': '주유소용지', '13': '창고용지', '14': '도로', '15': '철도용지',
    '16': '제방', '17': '하천', '18': '구거', '19': '유지', '20': '양어장',
    '21': '수도용지', '22': '공원', '23': '체육용지', '24': '유원지', '25': '종교용지',
    '26': '사적지', '27': '묘지', '28': '잡종지',
  };

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
        <td data-label="NO"><input type="number" class="ed-no" value="${r.no ?? i + 1}" /></td>
        <td data-label="동/리"><input type="text" class="ed-location" value="${escape(r.location ?? '')}" placeholder="예: 상교리" /></td>
        <td data-label="지번">
          <div class="ed-lot-wrap">
            <input type="text" class="ed-lot" value="${escape(r.lot ?? '')}" placeholder="예: 384-18 또는 산31" />
            <button class="ed-autofill" type="button" title="VWorld 에서 지목·면적 자동 채우기">🔍</button>
          </div>
        </td>
        <td data-label="지목">
          <select class="ed-category">
            ${CATEGORIES.map(c => `<option value="${c}" ${c === r.category ? 'selected' : ''}>${c}</option>`).join('')}
            ${r.category && !CATEGORIES.includes(r.category) ? `<option value="${r.category}" selected>${escape(r.category)}</option>` : ''}
          </select>
        </td>
        <td data-label="면적(㎡)"><input type="number" class="ed-area-m2" value="${r.area_m2 ?? 0}" min="0" /></td>
        <td data-label="평"><input type="number" class="ed-area-pyeong" value="${r.area_pyeong ?? Math.round((r.area_m2 || 0) * 0.3025)}" min="0" /></td>
        <td data-label="소유자"><input type="text" class="ed-owner" value="${escape(r.owner ?? '')}" placeholder="(VWorld 미제공)" /></td>
        <td data-label="비고"><input type="text" class="ed-memo" value="${escape(r.memo ?? '')}" /></td>
        <td data-label=""><button class="ed-delete" title="삭제">✕</button></td>
      `;
      // 면적 m² 바뀌면 평 자동 계산
      const m2 = tr.querySelector('.ed-area-m2');
      const py = tr.querySelector('.ed-area-pyeong');
      m2.addEventListener('input', () => { py.value = Math.round(parseFloat(m2.value || 0) * 0.3025); });
      tr.querySelector('.ed-delete').addEventListener('click', () => {
        rows.splice(i, 1);
        render();
      });
      tr.querySelector('.ed-autofill').addEventListener('click', () => autofillRow(tr));
      tbody.appendChild(tr);
    });
  }

  // ============ 자동 채우기 (VWorld 지오코딩 + WFS) ============
  async function autofillRow(tr) {
    const btn = tr.querySelector('.ed-autofill');
    const lotInput = tr.querySelector('.ed-lot');
    const locInput = tr.querySelector('.ed-location');
    const lot = lotInput.value.trim();
    const location = locInput.value.trim();
    const prefix = prefixInput.value.trim();
    if (!lot) { lotInput.focus(); alert('지번부터 입력하세요'); return; }
    const address = `${prefix} ${location} ${lot}`.trim();

    const key = (window.VWORLD_KEY || localStorage.getItem('vworld_api_key') || '').trim();
    if (!key) { alert('VWorld API 키가 설정되지 않았습니다'); return; }

    btn.textContent = '⏳';
    btn.disabled = true;
    tr.classList.add('ed-loading');
    try {
      const result = await fetchParcelAttrs(address, key);
      if (!result) throw new Error('해당 지번을 찾을 수 없습니다');

      // 폼에 적용
      if (result.jimok) {
        const sel = tr.querySelector('.ed-category');
        // 해당 옵션이 있으면 선택, 없으면 추가 후 선택
        let opt = Array.from(sel.options).find(o => o.value === result.jimok);
        if (!opt) {
          opt = new Option(result.jimok, result.jimok, true, true);
          sel.appendChild(opt);
        }
        sel.value = result.jimok;
      }
      if (result.area_m2 != null) {
        tr.querySelector('.ed-area-m2').value = Math.round(result.area_m2);
        tr.querySelector('.ed-area-pyeong').value = Math.round(result.area_m2 * 0.3025);
      }
      if (result.pnu) {
        // PNU 를 memo 에 기록 (소유자 확인용 외부 링크 메모)
        const memoInput = tr.querySelector('.ed-memo');
        if (!memoInput.value) memoInput.value = `PNU ${result.pnu}`;
      }
      tr.classList.remove('ed-loading');
      tr.classList.add('ed-success');
      setTimeout(() => tr.classList.remove('ed-success'), 1200);
    } catch (e) {
      tr.classList.remove('ed-loading');
      tr.classList.add('ed-error');
      setTimeout(() => tr.classList.remove('ed-error'), 1500);
      alert(`자동 채우기 실패: ${e.message}`);
    } finally {
      btn.textContent = '🔍';
      btn.disabled = false;
    }
  }

  async function fetchParcelAttrs(address, key) {
    // 1) 주소 → PNU + 좌표
    const geoUrl = `/api/vworld/address?` + new URLSearchParams({
      service: 'address', request: 'getcoord', version: '2.0', crs: 'epsg:4326',
      address, type: 'PARCEL', format: 'json', errorformat: 'json', key,
    });
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) throw new Error(`주소 조회 HTTP ${geoRes.status}`);
    const geoData = await geoRes.json();
    const pt = geoData?.response?.result?.point;
    const pnu = geoData?.response?.refined?.structure?.level4LC || null;
    if (!pt || !pnu) throw new Error(geoData?.response?.error?.text || 'PNU 추출 실패');

    // 2) PNU 로 필지 폴리곤 + 속성 조회
    const wfsUrl = `/api/vworld/data?` + new URLSearchParams({
      service: 'data', request: 'GetFeature', data: 'LP_PA_CBND_BUBUN',
      attrFilter: `pnu:=:${pnu}`,
      geometry: 'false', attribute: 'true', format: 'json', key,
      domain: window.location.hostname || 'localhost',
    });
    const wfsRes = await fetch(wfsUrl);
    if (!wfsRes.ok) throw new Error(`WFS HTTP ${wfsRes.status}`);
    const wfsData = await wfsRes.json();
    const features = wfsData?.response?.result?.featureCollection?.features || [];
    if (features.length === 0) {
      // 폴리곤 조회 실패 — PNU 만 반환
      return { pnu, jimok: null, area_m2: null };
    }
    const props = features[0].properties || {};

    // 지목 추출 — VWorld 응답 필드 다양성 대응
    let jimok = props.jibun_jimok || props.jimokNm || props.jimok_nm || props.jimok || '';
    // 코드(01~28) 면 매핑
    if (/^\d{2}$/.test(jimok)) jimok = JIMOK_CODE_MAP[jimok] || jimok;
    // 면적 추출
    const area = parseFloat(props.lndcgr_area || props.area || props.lndpcl_ar || 0);

    return {
      pnu,
      jimok: jimok || null,
      area_m2: area > 0 ? area : null,
      raw: props,
    };
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

  // 전체 자동 채우기 (큰 작업이므로 throttle)
  const autofillAllBtn = document.getElementById('editor-autofill-all');
  if (autofillAllBtn) {
    autofillAllBtn.addEventListener('click', async () => {
      const trs = Array.from(tbody.querySelectorAll('tr'));
      if (!trs.length) return;
      if (!confirm(`${trs.length}개 필지의 지목·면적을 VWorld 에서 일괄 조회합니다. 계속할까요?`)) return;
      autofillAllBtn.disabled = true;
      autofillAllBtn.textContent = '⏳ 조회 중...';
      for (let i = 0; i < trs.length; i++) {
        autofillAllBtn.textContent = `⏳ ${i + 1}/${trs.length}`;
        await autofillRow(trs[i]).catch(() => {});
        await new Promise(r => setTimeout(r, 250));   // VWorld 부하 완화
      }
      autofillAllBtn.disabled = false;
      autofillAllBtn.textContent = '🔍 전체 자동';
    });
  }

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
    if (!confirm('기본 41필지 (여주 북내면 상교리)로 복원합니다. 커스텀 데이터는 삭제돼요. 계속?')) return;
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

  // ===== 파일에서 지번 자동 추출 (이미지/PDF/엑셀/CSV) =====
  const extractBtn = document.getElementById('editor-file-import');
  const extractInput = document.getElementById('editor-extract-input');
  if (extractBtn && extractInput) {
    extractBtn.addEventListener('click', () => extractInput.click());
    extractInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const orig = extractBtn.textContent;
      extractBtn.disabled = true;
      extractBtn.textContent = '⏳ 추출 중... (이미지는 1~3분)';
      try {
        const data = await window.TwinLandExtract(file, (sec) => {
          extractBtn.textContent = `⏳ AI 분석 중… ${sec}초`;
        });
        const extracted = (data.parcels || []).map((p, i) => ({
          no: i + 1,
          location: p.location || '',
          lot: p.lot || '',
          category: '전',
          area_m2: 0,
          area_pyeong: 0,
          owner: '',
          memo: '',
        }));
        if (extracted.length === 0) {
          alert('지번을 찾지 못했습니다.' + (data.warnings?.length ? '\n' + data.warnings.join('\n') : ''));
          return;
        }
        // 빈 표면 교체, 기존 행 있으면 추가/교체 선택
        if (rows.length > 0) {
          const add = confirm(`기존 ${rows.length}행이 있습니다.\n확인=뒤에 추가 / 취소=교체`);
          if (add) {
            // 기존 행 번호는 보존, 추가분만 이어서 번호 부여
            const base = rows.length;
            extracted.forEach((r, i) => { r.no = base + i + 1; });
            rows = rows.concat(extracted);
          } else {
            rows = extracted;
          }
        } else {
          rows = extracted;
        }
        if (data.prefix && !prefixInput.value.trim()) prefixInput.value = data.prefix;
        render();
        const warn = data.warnings?.length ? '\n⚠ ' + data.warnings.join('\n⚠ ') : '';
        alert(`${extracted.length}개 지번 불러옴.\n지목·면적은 "🔍 전체 자동"으로 VWorld 에서 채우세요.${warn}`);
      } catch (err) {
        alert('파일 추출 실패: ' + err.message);
      } finally {
        extractBtn.disabled = false;
        extractBtn.textContent = orig;
        extractInput.value = '';
      }
    });
  }

  // 배경 클릭으로 닫기
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
})();
