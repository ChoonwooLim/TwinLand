// JooJoo Land - 프로젝트 관리
// 여러 지역/세팅을 이름으로 저장해서 전환 가능하게.
// 프로젝트 = { parcels, prefix, style, createdAt, updatedAt }

(function () {
  const PROJECTS_KEY = 'joojoo_projects';
  const ACTIVE_KEY = 'joojoo_active_project';
  const STYLE_KEY = 'joojoo_style';
  const PARCELS_KEY = 'joojoo_custom_parcels';
  const PREFIX_KEY = 'joojoo_address_prefix';

  function readAll() {
    try {
      return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }
  function writeAll(dict) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(dict));
  }
  function getActive() {
    return localStorage.getItem(ACTIVE_KEY) || '';
  }
  function setActive(name) {
    if (name) localStorage.setItem(ACTIVE_KEY, name);
    else localStorage.removeItem(ACTIVE_KEY);
  }

  function snapshotNow() {
    let style = null;
    try { style = window.CesiumApp?.getStyle?.() || null; } catch (e) {}
    if (!style) {
      try { style = JSON.parse(localStorage.getItem(STYLE_KEY)); } catch (e) {}
    }
    return {
      parcels: (window.PARCELS || window.DEFAULT_PARCELS || []).map(p => ({ ...p })),
      prefix: window.ADDRESS_PREFIX || window.DEFAULT_ADDRESS_PREFIX || '',
      style,
    };
  }

  function saveProject(name, overwrite) {
    const clean = String(name || '').trim();
    if (!clean) throw new Error('프로젝트 이름이 비어있음');
    const all = readAll();
    if (all[clean] && !overwrite) throw new Error(`이미 있음: ${clean}`);
    const snap = snapshotNow();
    const now = new Date().toISOString();
    all[clean] = {
      name: clean,
      parcels: snap.parcels,
      prefix: snap.prefix,
      style: snap.style,
      createdAt: all[clean]?.createdAt || now,
      updatedAt: now,
    };
    writeAll(all);
    setActive(clean);
    return all[clean];
  }

  function loadProject(name) {
    const all = readAll();
    const p = all[name];
    if (!p) throw new Error(`프로젝트 없음: ${name}`);
    localStorage.setItem(PARCELS_KEY, JSON.stringify(p.parcels || []));
    localStorage.setItem(PREFIX_KEY, p.prefix || '');
    if (p.style) localStorage.setItem(STYLE_KEY, JSON.stringify(p.style));
    else localStorage.removeItem(STYLE_KEY);
    setActive(name);
    location.reload();
  }

  function deleteProject(name) {
    const all = readAll();
    if (!all[name]) return;
    delete all[name];
    writeAll(all);
    if (getActive() === name) setActive('');
  }

  function listProjects() {
    const all = readAll();
    return Object.values(all).sort((a, b) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || '')
    );
  }

  // 처음 방문이면 기본 34필지를 "JooJooLand" 프로젝트로 시드
  function seedIfEmpty() {
    const all = readAll();
    if (Object.keys(all).length > 0) return;
    const now = new Date().toISOString();
    all['JooJooLand'] = {
      name: 'JooJooLand',
      parcels: (window.DEFAULT_PARCELS || []).map(p => ({ ...p })),
      prefix: window.DEFAULT_ADDRESS_PREFIX || '',
      style: null,
      createdAt: now,
      updatedAt: now,
    };
    writeAll(all);
    if (!getActive()) setActive('JooJooLand');
  }

  // =================== UI ===================
  function renderBadge() {
    const name = getActive() || '—';
    const badge = document.getElementById('active-project-label');
    if (badge) badge.textContent = name;
    const title = document.getElementById('project-title');
    if (title) title.textContent = name;
  }

  function renderList() {
    const wrap = document.getElementById('projects-list');
    if (!wrap) return;
    const active = getActive();
    const items = listProjects();
    if (items.length === 0) {
      wrap.innerHTML = '<div class="projects-empty">저장된 프로젝트 없음</div>';
      return;
    }
    wrap.innerHTML = items.map(p => {
      const isActive = p.name === active;
      const date = (p.updatedAt || '').slice(0, 10);
      const count = (p.parcels || []).length;
      return `
        <div class="project-row ${isActive ? 'active' : ''}">
          <div class="project-info">
            <div class="project-name">${escapeHtml(p.name)} ${isActive ? '<span class="project-active-tag">활성</span>' : ''}</div>
            <div class="project-meta">${count}필지 · ${escapeHtml(p.prefix || '')} · ${date}</div>
          </div>
          <div class="project-actions">
            <button class="project-btn-load" data-name="${escapeAttr(p.name)}" ${isActive ? 'disabled' : ''}>불러오기</button>
            <button class="project-btn-overwrite" data-name="${escapeAttr(p.name)}">덮어쓰기</button>
            <button class="project-btn-export" data-name="${escapeAttr(p.name)}">내보내기</button>
            <button class="project-btn-delete" data-name="${escapeAttr(p.name)}">삭제</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  function openModal() {
    document.getElementById('projects-modal').classList.remove('hidden');
    renderList();
  }
  function closeModal() {
    document.getElementById('projects-modal').classList.add('hidden');
  }

  function wireEvents() {
    const btn = document.getElementById('open-projects');
    if (btn) btn.addEventListener('click', openModal);

    const closeBtn = document.getElementById('projects-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    const modal = document.getElementById('projects-modal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    const saveNewBtn = document.getElementById('projects-save-new');
    if (saveNewBtn) saveNewBtn.addEventListener('click', () => {
      const input = document.getElementById('projects-new-name');
      const name = (input.value || '').trim();
      if (!name) return alert('이름 입력 필요');
      try {
        saveProject(name, false);
        input.value = '';
        renderBadge();
        renderList();
        alert(`"${name}" 프로젝트 저장됨`);
      } catch (e) {
        alert(e.message);
      }
    });

    const importBtn = document.getElementById('projects-import');
    const fileInput = document.getElementById('projects-file-input');
    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          const name = (data.name || file.name.replace(/\.json$/, '')).trim();
          const all = readAll();
          all[name] = {
            name,
            parcels: data.parcels || [],
            prefix: data.prefix || '',
            style: data.style || null,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          writeAll(all);
          renderList();
          alert(`"${name}" 가져옴`);
        } catch (err) {
          alert('가져오기 실패: ' + err.message);
        }
        fileInput.value = '';
      });
    }

    // 목록 내 버튼들 (이벤트 위임)
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const name = t.dataset.name;
      if (!name) return;
      if (t.classList.contains('project-btn-load')) {
        if (confirm(`"${name}" 불러올까? (현재 세팅은 덮어써져. 먼저 저장해두고 싶으면 취소.)`)) {
          loadProject(name);
        }
      } else if (t.classList.contains('project-btn-overwrite')) {
        if (confirm(`"${name}" 를 현재 세팅으로 덮어쓸까?`)) {
          try {
            saveProject(name, true);
            renderBadge();
            renderList();
          } catch (err) {
            alert(err.message);
          }
        }
      } else if (t.classList.contains('project-btn-delete')) {
        if (confirm(`"${name}" 삭제?`)) {
          deleteProject(name);
          renderBadge();
          renderList();
        }
      } else if (t.classList.contains('project-btn-export')) {
        const all = readAll();
        const p = all[name];
        if (!p) return;
        const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${name}.json`;
        a.click();
      }
    });
  }

  // =================== INIT ===================
  seedIfEmpty();
  // 활성 프로젝트의 parcels/prefix 가 localStorage 에 없으면 기본으로 쓰기 (최초 로드)
  (function syncActiveToLegacyKeys() {
    const active = getActive();
    if (!active) return;
    const all = readAll();
    const p = all[active];
    if (!p) return;
    if (!localStorage.getItem(PARCELS_KEY)) {
      localStorage.setItem(PARCELS_KEY, JSON.stringify(p.parcels || []));
    }
    if (!localStorage.getItem(PREFIX_KEY)) {
      localStorage.setItem(PREFIX_KEY, p.prefix || '');
    }
    if (p.style && !localStorage.getItem(STYLE_KEY)) {
      localStorage.setItem(STYLE_KEY, JSON.stringify(p.style));
    }
  })();

  document.addEventListener('DOMContentLoaded', () => {
    renderBadge();
    wireEvents();
  });

  window.ProjectStore = { list: listProjects, save: saveProject, load: loadProject, remove: deleteProject, getActive };
})();
