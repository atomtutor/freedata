// main.js
const app = document.getElementById('app');
const panes = { battle: document.getElementById('battle'), overview: document.getElementById('overview'), match: document.getElementById('match') };

function showTab(name) {
  Object.values(panes).forEach(p => p.classList.add('hidden'));
  panes[name].classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', e => showTab(e.target.dataset.tab)));

function applyParsed(parsed, sourceLabel) {
  if (!parsed || !parsed.rows || !parsed.rows.length) {
    showPasteMsg('데이터를 인식하지 못했어요. 1행(헤더)부터 마지막 응답까지 다시 복사해서 붙여넣어 주세요.', true);
    return;
  }
  const unit = getUnitLabel(parsed.schema);
  state.setData(parsed.rows, parsed.schema);
  showPasteMsg(`${parsed.rows.length}${unit} 데이터 적용됨 ✅${sourceLabel ? ' (' + sourceLabel + ')' : ''}`, false);
}

// ── 데이터 입력: 샘플 데이터 (내장된 CSV 텍스트를 그대로 파싱, fetch 없음) ──
document.getElementById('loadFake').addEventListener('click', () => {
  applyParsed(parseCSV(SAMPLE_CSV), '샘플 데이터');
});

// ── 데이터 입력: CSV 파일 업로드 (FileReader, file:// 에서도 정상 동작) ──
document.getElementById('fileInput').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => applyParsed(parseCSV(r.result), 'CSV 업로드');
  r.readAsText(f);
});

// ── 데이터 입력: 붙여넣기 ──
// "paste" 이벤트만 믿지 않고, 명시적으로 누르는 [적용하기] 버튼을 기본 경로로 둔다.
const pasteArea = document.getElementById('pasteArea');

document.getElementById('applyPaste').addEventListener('click', () => {
  applyParsed(parseCSV(pasteArea.value));
});

pasteArea.addEventListener('paste', e => {
  const clipboard = (e.clipboardData && e.clipboardData.getData) ? e.clipboardData.getData('text/plain') : null;
  if (clipboard) {
    e.preventDefault();
    pasteArea.value = clipboard;
  }
  setTimeout(() => {
    const parsed = parseCSV(pasteArea.value);
    if (parsed.rows.length) applyParsed(parsed);
  }, 30);
});

function showPasteMsg(text, isError) {
  const el = document.getElementById('pasteMsg');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', !!isError);
  el.classList.toggle('ok', !isError);
}

// ── 자동 감지된 컬럼 구성(범주형/수치형) 미리보기 ──
function renderSchemaPreview(schema) {
  const el = document.getElementById('schemaPreview');
  if (!el) return;
  if (!schema || (!schema.categorical.length && !schema.numeric.length)) { el.innerHTML = ''; return; }

  const catChips = schema.categorical.map(c =>
    `<span class="schema-chip cat">${c.key} <small>(${c.values.join('・')})</small></span>`
  ).join('') || '<span class="schema-empty">없음</span>';

  const numChips = schema.numeric.map(k => `<span class="schema-chip num">${k}</span>`).join('') || '<span class="schema-empty">없음</span>';

  const extra = [];
  if (schema.idKey) extra.push(`식별자: <strong>${schema.idKey}</strong>`);
  if (schema.timeKey) extra.push(`시간: <strong>${schema.timeKey}</strong> (분석 제외)`);

  el.innerHTML = `
    <div class="schema-row"><span class="schema-label">🏷️ 범주형</span>${catChips}</div>
    <div class="schema-row"><span class="schema-label">🔢 수치형</span>${numChips}</div>
    ${extra.length ? `<div class="schema-extra">${extra.join(' · ')}</div>` : ''}
  `;
}

// init panels
initBattle(panes.battle);
initOverview(panes.overview);
initMatch(panes.match);

// 데이터 갱신 시 상단 카운트/스키마 미리보기 + 현재 탭 다시 그리기
document.addEventListener('dataUpdated', (e) => {
  const rows = (e && e.detail && e.detail.rows) || state.data || [];
  const schema = (e && e.detail && e.detail.schema) || state.schema;

  const el = document.getElementById('dataCount');
  if (el) {
    const unit = getUnitLabel(schema);
    el.textContent = `응답 ${rows.length}${unit} 로드됨`;
    el.classList.add('updated');
    setTimeout(() => el.classList.remove('updated'), 900);
  }
  renderSchemaPreview(schema);

  const active = document.querySelector('.tab.active').dataset.tab;
  if (active === 'battle') initBattle(panes.battle);
  if (active === 'overview') initOverview(panes.overview);
  if (active === 'match') initMatch(panes.match);
});

// 시작하자마자 샘플 데이터 자동 로드
applyParsed(parseCSV(SAMPLE_CSV), '샘플 데이터');
