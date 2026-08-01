// main.js
const app = document.getElementById('app');
const panes = { battle: document.getElementById('battle'), overview: document.getElementById('overview'), match: document.getElementById('match') };

// 탭별로 "마지막으로 그렸을 때의 state.version"을 기록해둔다.
// 데이터가 바뀌어도 화면에 보이지 않는 탭까지 매번 다시 그릴 필요는 없으니,
// 그 탭을 다시 볼 때(showTab) 버전이 다르면 그때 다시 그린다.
const renderedVersion = { battle: -1, overview: -1, match: -1 };
function renderTab(name) {
  if (name === 'battle') initBattle(panes.battle);
  if (name === 'overview') initOverview(panes.overview);
  if (name === 'match') initMatch(panes.match);
  renderedVersion[name] = state.version;
}

function showTab(name) {
  Object.values(panes).forEach(p => p.classList.add('hidden'));
  panes[name].classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  // 데이터가 바뀐 뒤 한 번도 안 그려진(=stale) 탭이면 지금 다시 그린다
  if (renderedVersion[name] !== state.version) renderTab(name);
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', e => showTab(e.target.dataset.tab)));

// ── 화면 전환: 입력 화면 ↔ 분석 화면 ──
const screenInput = document.getElementById('screenInput');
const screenAnalysis = document.getElementById('screenAnalysis');

document.getElementById('startAnalysis').addEventListener('click', () => {
  screenInput.classList.add('hidden');
  screenAnalysis.classList.remove('hidden');
  showTab('overview'); // 분석 화면에 들어갈 때는 항상 "데이터 한눈에"부터 보여준다
  window.scrollTo(0, 0);
});

document.getElementById('backToInput').addEventListener('click', () => {
  screenAnalysis.classList.add('hidden');
  screenInput.classList.remove('hidden');
  window.scrollTo(0, 0);
});

function applyParsed(parsed, sourceLabel) {
  if (!parsed || !parsed.rows || !parsed.rows.length) {
    showPasteMsg('데이터를 인식하지 못했어요. 1행(헤더)부터 마지막 응답까지 다시 복사해서 붙여넣어 주세요.', true);
    return;
  }
  const unit = getUnitLabel(parsed.schema);
  state.setData(parsed.rows, parsed.schema);
  showPasteMsg(`${parsed.rows.length}${unit} 데이터 적용됨 ✅${sourceLabel ? ' (' + sourceLabel + ')' : ''}`, false);
  showSheetMsg(''); // 다른 방법으로 데이터가 정상 적용됐으면 이전 시트 링크 오류 메시지는 지운다
}

// ── 데이터 입력: 샘플 데이터 (내장된 CSV 텍스트를 그대로 파싱, fetch 없음) ──
document.getElementById('loadFake').addEventListener('click', () => {
  pasteArea.value = SAMPLE_CSV;
  applyParsed(parseCSV(SAMPLE_CSV), '샘플 데이터');
});

// ── 데이터 입력: CSV 파일 업로드 (FileReader, file:// 에서도 정상 동작) ──
// UTF-8/EUC-KR 자동 감지를 위해 텍스트가 아닌 바이트(ArrayBuffer)로 읽는다.
document.getElementById('fileInput').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const text = decodeBytes(r.result);
    pasteArea.value = text;
    applyParsed(parseCSV(text), 'CSV 업로드');
  };
  r.readAsArrayBuffer(f);
});

// ── 데이터 입력: 구글 시트 링크 ──
// 공유 링크(.../d/{id}/edit...)를 CSV 내보내기 링크(.../export?format=csv)로 자동 변환해서 불러온다.
// 이미 "게시된 웹(pub)" 링크나 output=csv 링크를 넣으면 그대로 사용한다.
// (이 앱은 GitHub Pages 같은 https 서버에서 서빙되는 걸 기준으로 하며, file:// 더블클릭 실행에서는
//  브라우저 정책상 이 fetch가 막힐 수 있다 — 그런 경우를 대비해 "새 탭에서 확인" 폴백을 함께 제공한다.)
function buildSheetCsvUrl(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) return null;
  if (/output=csv/i.test(url) || /\/pub\?/i.test(url)) return url;
  const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const id = idMatch[1];
  const gidMatch = url.match(/gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

const sheetUrlInput = document.getElementById('sheetUrlInput');
const loadSheetBtn = document.getElementById('loadSheetUrl');

function showSheetMsg(text) {
  const el = document.getElementById('sheetMsg');
  if (el) el.textContent = text || '';
}

// 링크 문제(형식 오류/비공개/네트워크 실패)를 안내하면서, 입력칸은 깨끗하게 비워
// 바로 다시 입력할 수 있게 한다.
function sheetError(message) {
  showSheetMsg(message);
  sheetUrlInput.value = '';
  sheetUrlInput.focus();
}

document.getElementById('openSheetCsv').addEventListener('click', () => {
  const csvUrl = buildSheetCsvUrl(sheetUrlInput.value);
  if (!csvUrl) { sheetError('올바른 구글 시트 링크가 아니에요. "docs.google.com/spreadsheets/d/..." 형태의 링크를 넣어주세요.'); return; }
  window.open(csvUrl, '_blank');
});

loadSheetBtn.addEventListener('click', async () => {
  const csvUrl = buildSheetCsvUrl(sheetUrlInput.value);
  if (!csvUrl) {
    sheetError('올바른 구글 시트 링크가 아니에요. "docs.google.com/spreadsheets/d/..." 형태의 링크를 넣어주세요.');
    return;
  }
  const originalText = loadSheetBtn.textContent;
  loadSheetBtn.disabled = true;
  loadSheetBtn.textContent = '불러오는 중...';
  showSheetMsg('');
  showPasteMsg('구글 시트에서 불러오는 중이에요...', false);

  try {
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    // UTF-8/EUC-KR 자동 감지를 위해 텍스트가 아닌 바이트(ArrayBuffer)로 받는다.
    const buffer = await res.arrayBuffer();
    const text = decodeBytes(buffer);
    // 비공개 시트면 CSV 대신 로그인 페이지(HTML)가 돌아온다 — 그 경우를 감지
    if (/^\s*<(!doctype|html)/i.test(text)) throw new Error('비공개 시트이거나 접근 권한이 없어요.');
    pasteArea.value = text;
    applyParsed(parseCSV(text), '구글 시트 링크');
  } catch (err) {
    sheetError('불러오지 못했어요. 시트 공유 설정을 "링크가 있는 모든 사용자(뷰어)"로 바꾼 뒤 다시 시도하거나, [새 탭에서 확인] 버튼으로 연 화면의 내용을 전체 복사(Ctrl+A → Ctrl+C)해서 아래 textarea에 붙여넣어 주세요.');
  } finally {
    loadSheetBtn.disabled = false;
    loadSheetBtn.textContent = originalText;
  }
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

// init panels (초기 빈 상태로 한 번 그려두고, version은 기록해두지 않는다 → 첫 데이터 로드 시 모든 탭이 stale 처리됨)
initBattle(panes.battle);
initOverview(panes.overview);
initMatch(panes.match);

// 데이터 갱신 시 상단 카운트/스키마 미리보기 + 지금 보고 있는 탭만 바로 다시 그리기
// (다른 탭들은 stale 상태로 남고, 사용자가 그 탭을 클릭하는 순간 showTab에서 다시 그려짐)
document.addEventListener('dataUpdated', (e) => {
  const rows = (e && e.detail && e.detail.rows) || state.data || [];
  const schema = (e && e.detail && e.detail.schema) || state.schema;

  const el = document.getElementById('dataCount');
  const elMini = document.getElementById('dataCountMini');
  const unit = getUnitLabel(schema);
  const countText = `응답 ${rows.length}${unit} 로드됨`;
  if (el) {
    el.textContent = countText;
    el.classList.add('updated');
    setTimeout(() => el.classList.remove('updated'), 900);
  }
  if (elMini) {
    elMini.textContent = countText;
    elMini.classList.add('updated');
    setTimeout(() => elMini.classList.remove('updated'), 900);
  }
  renderSchemaPreview(schema);

  const active = document.querySelector('.tab.active').dataset.tab;
  renderTab(active);
});

// 시작하자마자 샘플 데이터 자동 로드 (단, 사용자가 직접 요청한 게 아니므로
// textarea는 건드리지 않고 빈 상태로 둔다 — "기본 상태"를 유지)
applyParsed(parseCSV(SAMPLE_CSV), '샘플 데이터');
