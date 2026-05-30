// 지도 정보 팝업 (재사용) — window.MapPopup.show(title, rowsHtml) / hide()
window.MapPopup = (function () {
  let el = null;
  function ensure() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'map-info-popup';
    el.style.cssText = 'position:absolute;top:120px;right:16px;z-index:1200;display:none;'
      + 'max-width:320px;background:#fff;color:#222;border:1px solid #ccc;border-radius:6px;'
      + 'box-shadow:0 2px 12px rgba(0,0,0,.25);font-size:13px;overflow:hidden;';
    document.body.appendChild(el);
    return el;
  }
  function show(title, rowsHtml) {
    const n = ensure();
    n.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;'
      + 'padding:8px 10px;background:#1a237e;color:#fff;">'
      + '<strong style="font-size:13px;">' + (title || '정보') + '</strong>'
      + '<span id="map-info-popup-x" style="cursor:pointer;padding:0 4px;">✕</span></div>'
      + '<div style="padding:8px 10px;">' + rowsHtml + '</div>';
    n.style.display = 'block';
    const x = document.getElementById('map-info-popup-x');
    if (x) x.onclick = hide;
  }
  function hide() { if (el) el.style.display = 'none'; }
  function rows(pairs) {
    return pairs.filter(Boolean).map(function (kv) {
      return '<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #f0f0f0;">'
        + '<span style="color:#789;min-width:92px;flex:none;">' + kv[0] + '</span>'
        + '<span>' + kv[1] + '</span></div>';
    }).join('');
  }
  return { show, hide, rows };
})();
