// tab-battle.js
function avg(arr, field) { if (!arr.length) return 0; return arr.reduce((s, x) => s + (Number(x[field]) || 0), 0) / arr.length }
function round1(n) { return Math.round(n * 10) / 10; }

// ── 한글 조사(은/는, 이/가) 자동 처리 ──
function hasBatchim(ch) {
  const code = ch.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return false; // 한글 음절이 아니면 받침 없다고 취급
  return (code - 0xAC00) % 28 !== 0;
}
// "단백질(g)", "칼로리 (kcal)"처럼 끝에 단위/설명이 괄호로 붙은 경우, 조사는 괄호
// 앞의 실제 단어를 기준으로 판단해야 한다(괄호의 마지막 글자 ')'를 기준으로 하면 틀림).
function coreWord(word) {
  const stripped = String(word || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  return stripped || word;
}
function josaEunNeun(word) { const w = coreWord(word); const last = w[w.length - 1]; return hasBatchim(last) ? '은' : '는'; }
function josaIGa(word) { const w = coreWord(word); const last = w[w.length - 1]; return hasBatchim(last) ? '이' : '가'; }

// 서술어 어간: 범주형 비율 비교 및 "~수"로 끝나는 수치형 컬럼(반려동물수 등)은 "많다",
// 그 외 점수·척도형 수치는 "높다"
function verbStem(def) {
  if (def.type === 'category') return '많';
  return def.field.endsWith('수') ? '많' : '높';
}

const CONFETTI_COLORS = ['var(--pink)', 'var(--teal)', 'var(--yellow)'];
function spawnConfetti(layer) {
  layer.innerHTML = '';
  const count = 26;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = (Math.random() * 100) + '%';
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.animationDelay = (Math.random() * 200) + 'ms';
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(piece);
  }
  setTimeout(() => { layer.innerHTML = ''; }, 1400);
}

// 주어(subject)가 속한 컬럼(key)을 제외한 나머지 컬럼들로 지표(metric) 후보 목록을 만든다.
// - 수치형 컬럼: 평균 비교 ("급식만족도가 높다" 등)
// - 범주형 컬럼(주어 컬럼 제외): 그 값의 비율(%) 비교 ("P가 많다", "저녁형이 많다" 등)
function buildMetricDefs(schema, subjectKey) {
  const list = [];
  (schema.numeric || []).forEach(k => list.push({ type: 'numeric', field: k, label: k, groupLabel: '수치형' }));
  (schema.categorical || []).forEach(c => {
    if (c.key === subjectKey) return; // 주어와 같은 컬럼은 비교 대상에서 제외 (자기 자신과 비교 방지)
    c.values.forEach(v => list.push({ type: 'category', field: c.key, target: v, label: v, groupLabel: c.key }));
  });
  return list;
}

// defs를 groupLabel 기준 <optgroup>으로 묶어 select에 채워 넣는다.
function populateMetricSelect(selectEl, defs) {
  const groups = [];
  const idxByGroup = {};
  defs.forEach((d, i) => {
    if (!(d.groupLabel in idxByGroup)) { idxByGroup[d.groupLabel] = groups.length; groups.push({ label: d.groupLabel, items: [] }); }
    groups[idxByGroup[d.groupLabel]].items.push(i);
  });
  selectEl.innerHTML = groups.map(g =>
    `<optgroup label="${g.label}">${g.items.map(i => `<option value="${i}">${defs[i].label}</option>`).join('')}</optgroup>`
  ).join('');
}

// 이전에 고르고 있던 지표와 최대한 비슷한(타입/필드/타깃이 같은) 지표를 새 목록에서 찾아 유지한다.
function findEquivalentIndex(defs, prevDef) {
  if (!prevDef) return 0;
  const idx = defs.findIndex(d => d.type === prevDef.type && d.field === prevDef.field && d.target === prevDef.target);
  return idx >= 0 ? idx : 0;
}

function initBattle(container) {
  const schema = state.schema;
  const hasCategorical = schema && schema.categorical && schema.categorical.length;
  const hasNumeric = schema && schema.numeric && schema.numeric.length;
  const unit = (typeof getUnitLabel === 'function') ? getUnitLabel(schema) : '건';

  if (!hasCategorical || (!hasNumeric && schema.categorical.length < 2)) {
    container.innerHTML = `<div class="match-empty">비교할 범주형(2~8개 값) 항목과, 비교 기준이 될 수치형 또는 다른 범주형 항목이 함께 있어야 가설 대결을 할 수 있어요.<br>데이터를 불러오면 자동으로 인식됩니다.</div>`;
    return;
  }

  // 범주형 컬럼별 옵션그룹 생성 (주어 드롭다운)
  const subjectGroups = schema.categorical.map(c =>
    `<optgroup label="${c.key}">${c.values.map(v => `<option value="${v}" data-key="${c.key}">${v}</option>`).join('')}</optgroup>`
  ).join('');

  container.innerHTML = `
    <div class="sentence-builder">
      <select id="subject" class="select">${subjectGroups}</select>
      <span class="josa" id="josa1">은(는)</span>
      <select id="metric" class="select"></select>
      <span class="josa" id="josa2">가(이)</span>
      <span class="static-text" id="verbText">높다!</span>
    </div>
    <div class="confirm-row">
      <button id="battleStart" class="btn">확인</button>
    </div>
    <div class="battle-result">
      <div id="resultLeft" class="result-left">
        <div class="confetti-layer" id="confettiLayer"></div>
        <div id="stamp" class="stamp-emoji" aria-hidden="true"></div>
        <div id="resultSentence" class="result-sentence"></div>
      </div>
      <div class="result-right">
        <div class="bars-vertical">
          <div class="bar-col">
            <div class="bar-track"><div id="barA" class="bar-fill a"></div></div>
            <div class="bar-value" id="valueA">0</div>
            <div class="bar-label" id="labelA"></div>
          </div>
          <div class="bar-col">
            <div class="bar-track"><div id="barB" class="bar-fill b"></div></div>
            <div class="bar-value" id="valueB">0</div>
            <div class="bar-label" id="labelB"></div>
          </div>
        </div>
      </div>
    </div>
    <div id="countInfo" class="stat muted"></div>
  `;

  const subject = container.querySelector('#subject');
  const metric = container.querySelector('#metric');
  const josa1El = container.querySelector('#josa1');
  const josa2El = container.querySelector('#josa2');
  const verbText = container.querySelector('#verbText');
  const labelA = container.querySelector('#labelA');
  const labelB = container.querySelector('#labelB');
  const start = container.querySelector('#battleStart');
  const barA = container.querySelector('#barA');
  const barB = container.querySelector('#barB');
  const valueA = container.querySelector('#valueA');
  const valueB = container.querySelector('#valueB');
  const stamp = container.querySelector('#stamp');
  const resultLeft = container.querySelector('#resultLeft');
  const resultSentence = container.querySelector('#resultSentence');
  const confettiLayer = container.querySelector('#confettiLayer');
  const info = container.querySelector('#countInfo');

  let metricDefs = [];

  function selectedSubject() {
    const opt = subject.options[subject.selectedIndex];
    return { value: opt.value, key: opt.dataset.key };
  }
  function currentMetricDef() { return metricDefs[Number(metric.value)]; }

  // 지표(def)를 기준으로 특정 범주값(colKey=value)의 대표값을 계산한다.
  // - 수치형 지표: 그 범주에 속한 응답들의 평균
  // - 범주형 지표(다른 컬럼의 특정 값 비율): 그 범주에 속한 응답 중 target 값의 비율(%)
  function groupValue(colKey, value, def) {
    const arr = state.data.filter(d => String(d[colKey]) === value);
    if (def.type === 'category') return arr.length ? (arr.filter(d => String(d[def.field]) === def.target).length / arr.length * 100) : 0;
    return avg(arr, def.field);
  }

  // 주어 컬럼의 모든 범주값을 해당 지표 기준으로 순위 매긴다 (내림차순).
  function rankSubjectValues(sv, def) {
    const col = schema.categorical.find(c => c.key === sv.key);
    return (col ? col.values : [sv.value])
      .map(v => ({ value: v, val: groupValue(sv.key, v, def) }))
      .sort((a, b) => b.val - a.val);
  }

  function refreshMetricOptions(keepPrevDef) {
    const sv = selectedSubject();
    metricDefs = buildMetricDefs(schema, sv.key);
    if (!metricDefs.length) {
      // 예외적으로 비교할 지표가 하나도 없는 경우(범주형 컬럼이 1개뿐이고 수치형도 없을 때)
      container.innerHTML = `<div class="match-empty">'${sv.key}' 외에 비교할 수 있는 항목이 없어요.</div>`;
      return false;
    }
    populateMetricSelect(metric, metricDefs);
    metric.selectedIndex = findEquivalentIndex(metricDefs, keepPrevDef);
    return true;
  }

  function updateSentence() {
    const sv = selectedSubject();
    const def = currentMetricDef();
    if (!def) return;
    const stem = verbStem(def);
    josa1El.textContent = josaEunNeun(sv.value);
    josa2El.textContent = josaIGa(def.label);
    verbText.textContent = `가장 ${stem}다!`;
    labelA.textContent = sv.value;
    // 실제 경쟁 상대는 결과 공개 시점에 계산해서 보여준다 (미리 보여주면 스포일러가 됨)
    labelB.textContent = '?';
    valueA.textContent = ''; valueB.textContent = '';
    barA.style.height = '6%'; barB.style.height = '6%';
    stamp.classList.remove('show'); stamp.textContent = '';
    resultSentence.classList.remove('show'); resultSentence.textContent = '';
    resultLeft.classList.remove('ok', 'no', 'tie');
  }

  subject.addEventListener('change', () => {
    const prevDef = currentMetricDef();
    if (!refreshMetricOptions(prevDef)) return;
    updateSentence();
  });
  metric.addEventListener('change', updateSentence);

  if (!refreshMetricOptions(null)) return;
  updateSentence();

  start.addEventListener('click', () => {
    const sv = selectedSubject();
    const def = currentMetricDef();
    if (!def) return;
    const mLabel = def.label;
    const stem = verbStem(def);
    const isCategory = def.type === 'category';
    const valueUnit = isCategory ? '%' : '';

    sound.drumroll();
    stamp.textContent = ''; stamp.classList.remove('show');
    resultSentence.classList.remove('show');
    resultLeft.classList.remove('ok', 'no', 'tie');
    confettiLayer.innerHTML = '';

    setTimeout(() => {
      // 주어 컬럼에 범주가 여러 개 있을 수 있으므로, "나머지 전체 평균"이 아니라
      // "이 지표 기준으로 모든 범주 중 실제 1등이 누구인지"를 계산한다.
      // (범주가 3개 이상일 때 여러 범주가 동시에 "나머지보다 높다"며 O가 나오는
      //  모순을 막기 위함 — 오직 진짜 1등만 O를 받는다)
      const ranked = rankSubjectValues(sv, def);
      const gEntry = ranked.find(r => r.value === sv.value);
      const gAvg = gEntry.val;
      const topRounded = round1(ranked[0].val);
      const gRounded = round1(gAvg);
      const tiedForFirst = ranked.filter(r => round1(r.val) === topRounded);
      const selectedIsTop = gRounded === topRounded;

      let result;
      if (selectedIsTop && tiedForFirst.length > 1) result = 'TIE';
      else if (selectedIsTop) result = 'O';
      else result = 'X';

      // 오른쪽 막대에 보여줄 비교 대상: O면 2등(러너업), X면 실제 1등, TIE면 공동 1위인 다른 범주
      let compareEntry;
      if (result === 'O') {
        compareEntry = ranked.find(r => r.value !== sv.value && round1(r.val) !== topRounded) || ranked.find(r => r.value !== sv.value);
      } else if (result === 'TIE') {
        compareEntry = tiedForFirst.find(r => r.value !== sv.value);
      } else {
        compareEntry = ranked[0];
      }
      const ov = compareEntry ? compareEntry.value : '나머지';
      const rAvg = compareEntry ? compareEntry.val : 0;

      const max = Math.max(gAvg, rAvg, 1);
      barA.style.height = Math.max(6, (gAvg / max) * 100) + '%'; valueA.textContent = round1(gAvg) + valueUnit;
      barB.style.height = Math.max(6, (rAvg / max) * 100) + '%'; valueB.textContent = round1(rAvg) + valueUnit;
      labelA.textContent = sv.value; labelB.textContent = ov;
      info.textContent = `응답 ${state.data.length}${unit} 기준, '${sv.key}' 범주 ${ranked.length}개 중 순위예요. 데이터가 늘어나면 또 바뀔 수도 있어요 😏`;

      setTimeout(() => {
        if (result === 'TIE') {
          stamp.textContent = '🤝';
          resultLeft.classList.add('tie');
          resultSentence.textContent = `${sv.value} · ${ov} 두 범주가 공동 1위예요! ${mLabel}${josaIGa(mLabel)} 거의 같았어요 🤝`;
          sound.tie();
        } else if (result === 'O') {
          stamp.textContent = '⭕';
          resultLeft.classList.add('ok');
          resultSentence.textContent = compareEntry
            ? `${sv.value}${josaEunNeun(sv.value)} ${mLabel}${josaIGa(mLabel)} 진짜 1등이었어요! (2등: ${ov})`
            : `${sv.value}${josaEunNeun(sv.value)} ${mLabel}${josaIGa(mLabel)} 정말 가장 ${stem}았어요!`;
          sound.ding(); spawnConfetti(confettiLayer);
        } else {
          stamp.textContent = '❌';
          resultLeft.classList.add('no');
          resultSentence.textContent = `${sv.value}${josaEunNeun(sv.value)} ${mLabel}${josaIGa(mLabel)} 가장 ${stem}지는 않았어요! 사실 1등은 '${ov}'예요!`;
          sound.buzz();
        }
        stamp.classList.add('show');
        setTimeout(() => resultSentence.classList.add('show'), 50);
      }, 700);
    }, 800);
  });
}
