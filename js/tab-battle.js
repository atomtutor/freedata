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

// 지표 컬럼명이 "~수"로 끝나면(반려동물수, 형제자매수 등) "많다", 그 외(점수·척도형)는 "높다"
function verbStem(colName) { return colName.endsWith('수') ? '많' : '높'; }

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

function initBattle(container) {
  const schema = state.schema;
  const hasCategorical = schema && schema.categorical && schema.categorical.length;
  const hasNumeric = schema && schema.numeric && schema.numeric.length;

  if (!hasCategorical || !hasNumeric) {
    container.innerHTML = `<div class="match-empty">비교할 수 있는 범주형(2~8개 값) 항목과 수치형 항목이 모두 있어야 가설 대결을 할 수 있어요.<br>데이터를 불러오면 자동으로 인식됩니다.</div>`;
    return;
  }

  // 범주형 컬럼별 옵션그룹 생성
  const subjectGroups = schema.categorical.map(c =>
    `<optgroup label="${c.key}">${c.values.map(v => `<option value="${v}" data-key="${c.key}">${v}</option>`).join('')}</optgroup>`
  ).join('');
  const metricOptions = schema.numeric.map(k => `<option value="${k}">${k}</option>`).join('');

  container.innerHTML = `
    <div class="sentence-builder">
      <select id="subject" class="select">${subjectGroups}</select>
      <span class="josa" id="josa1">은(는)</span>
      <select id="metric" class="select">${metricOptions}</select>
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

  function selectedSubject() {
    const opt = subject.options[subject.selectedIndex];
    return { value: opt.value, key: opt.dataset.key };
  }
  function metricLabel() { return metric.options[metric.selectedIndex].textContent; }
  function oppositeLabel(key, value) {
    const col = schema.categorical.find(c => c.key === key);
    if (col && col.values.length === 2) return col.values.find(v => v !== value) || '나머지';
    return '나머지';
  }

  function updateSentence() {
    const sv = selectedSubject();
    const stem = verbStem(metric.value);
    josa1El.textContent = josaEunNeun(sv.value);
    josa2El.textContent = josaIGa(metricLabel());
    verbText.textContent = `${stem}다!`;
    labelA.textContent = sv.value;
    labelB.textContent = oppositeLabel(sv.key, sv.value);
    stamp.classList.remove('show'); stamp.textContent = '';
    resultSentence.classList.remove('show'); resultSentence.textContent = '';
    resultLeft.classList.remove('ok', 'no', 'tie');
  }
  subject.addEventListener('change', updateSentence);
  metric.addEventListener('change', updateSentence);
  updateSentence();

  start.addEventListener('click', () => {
    const sv = selectedSubject();
    const mf = metric.value;
    const mLabel = metricLabel();
    const stem = verbStem(mf);
    const ov = oppositeLabel(sv.key, sv.value);

    sound.drumroll();
    stamp.textContent = ''; stamp.classList.remove('show');
    resultSentence.classList.remove('show');
    resultLeft.classList.remove('ok', 'no', 'tie');
    confettiLayer.innerHTML = '';

    setTimeout(() => {
      const group = state.data.filter(d => String(d[sv.key]) === sv.value);
      const rest = state.data.filter(d => String(d[sv.key]) !== sv.value);
      const gAvg = avg(group, mf); const rAvg = avg(rest, mf);
      const max = Math.max(gAvg, rAvg, 1);

      barA.style.height = Math.max(6, (gAvg / max) * 100) + '%'; valueA.textContent = round1(gAvg);
      barB.style.height = Math.max(6, (rAvg / max) * 100) + '%'; valueB.textContent = round1(rAvg);
      info.textContent = `응답 ${state.data.length}건 기준 결과예요. 데이터가 늘어나면 또 바뀔 수도 있어요 😏`;

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
