// tab-battle.js
function avg(arr, field) { if (!arr.length) return 0; return arr.reduce((s, x) => s + (Number(x[field]) || 0), 0) / arr.length }
function round1(n) { return Math.round(n * 10) / 10; }

// ── 한글 조사(은/는, 이/가) 자동 처리 ──
function hasBatchim(ch) {
  const code = ch.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return false; // 한글 음절이 아니면 받침 없다고 취급
  return (code - 0xAC00) % 28 !== 0;
}
function josaEunNeun(word) { const last = word[word.length - 1]; return hasBatchim(last) ? '은' : '는'; }
function josaIGa(word) { const last = word[word.length - 1]; return hasBatchim(last) ? '이' : '가'; }

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
  function oppositeLabel(key, value) {
    const col = schema.categorical.find(c => c.key === key);
    if (col && col.values.length === 2) return col.values.find(v => v !== value) || '나머지';
    return '나머지';
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
    verbText.textContent = `${stem}다!`;
    labelA.textContent = sv.value;
    labelB.textContent = oppositeLabel(sv.key, sv.value);
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
    const ov = oppositeLabel(sv.key, sv.value);
    const isCategory = def.type === 'category';
    const valueUnit = isCategory ? '%' : '';

    sound.drumroll();
    stamp.textContent = ''; stamp.classList.remove('show');
    resultSentence.classList.remove('show');
    resultLeft.classList.remove('ok', 'no', 'tie');
    confettiLayer.innerHTML = '';

    setTimeout(() => {
      const group = state.data.filter(d => String(d[sv.key]) === sv.value);
      const rest = state.data.filter(d => String(d[sv.key]) !== sv.value);

      function metricValue(arr) {
        if (isCategory) return arr.length ? (arr.filter(d => String(d[def.field]) === def.target).length / arr.length * 100) : 0;
        return avg(arr, def.field);
      }
      const gAvg = metricValue(group); const rAvg = metricValue(rest);
      const max = Math.max(gAvg, rAvg, 1);

      barA.style.height = Math.max(6, (gAvg / max) * 100) + '%'; valueA.textContent = round1(gAvg) + valueUnit;
      barB.style.height = Math.max(6, (rAvg / max) * 100) + '%'; valueB.textContent = round1(rAvg) + valueUnit;
      info.textContent = `응답 ${state.data.length}${unit} 기준 결과예요. 데이터가 늘어나면 또 바뀔 수도 있어요 😏`;

      setTimeout(() => {
        // 화면에 보이는 반올림 값 기준으로 판정 (반올림 시 같아 보이면 무승부 처리)
        const gR = round1(gAvg), rR = round1(rAvg);
        let result;
        if (gR === rR) result = 'TIE';
        else result = gR > rR ? 'O' : 'X';

        if (result === 'TIE') {
          stamp.textContent = '🤝';
          resultLeft.classList.add('tie');
          resultSentence.textContent = `${sv.value} · ${ov} 두 그룹의 ${mLabel}${josaIGa(mLabel)} 거의 같았어요! 무승부예요 🤝`;
          sound.tie();
        } else if (result === 'O') {
          stamp.textContent = '⭕';
          resultLeft.classList.add('ok');
          resultSentence.textContent = `${sv.value}${josaEunNeun(sv.value)} ${mLabel}${josaIGa(mLabel)} 정말 더 ${stem}았어요!`;
          sound.ding(); spawnConfetti(confettiLayer);
        } else {
          stamp.textContent = '❌';
          resultLeft.classList.add('no');
          resultSentence.textContent = `${sv.value}${josaEunNeun(sv.value)} ${mLabel}${josaIGa(mLabel)} 더 ${stem}지는 않았어요!`;
          sound.buzz();
        }
        stamp.classList.add('show');
        setTimeout(() => resultSentence.classList.add('show'), 50);
      }, 700);
    }, 800);
  });
}
