// tab-overview.js
function percent(count, total) { return total ? Math.round(count / total * 100) : 0 }

function getOverviewFields(schema) {
  const fields = [];
  (schema.categorical || []).forEach(c => fields.push({ key: c.key, label: c.key, type: 'category', order: c.values }));
  (schema.numeric || []).forEach(k => fields.push({ key: k, label: k, type: 'numeric' }));
  return fields;
}

const PALETTE = ['var(--pink)', 'var(--teal)'];

// 값이 다양한 수치형 컬럼을 몇 개(HIST_BUCKET_TARGET 근처)의 구간으로 묶을지 정한다.
// 서로 다른 값의 개수가 이 기준(HIST_UNIQUE_THRESHOLD)을 넘으면, 값 하나하나를 막대로
// 그리지 않고 "80~100"처럼 구간으로 묶어서 5~7개 정도의 막대로 보여준다.
const HIST_UNIQUE_THRESHOLD = 10;
const HIST_BUCKET_TARGET = 6;

// 1, 2, 5 규칙의 "보기 좋은" 폭 후보들 중에서, 구간 개수가 목표(HIST_BUCKET_TARGET, 5~7개
// 범위)에 가장 가까워지는 폭을 골라준다. (예: 범위 308이면 40이 아니라 50을 선택 → 7구간)
// 후보 폭의 자릿수(exp)는 range의 크기(로그 스케일)에 맞춰 동적으로 정한다 — 예를 들어
// 매출액처럼 range가 1,000억 단위든, 칼로리처럼 range가 수백 단위든 항상 적절한 구간 개수가 나오게 한다.
function niceStep(range) {
  if (!isFinite(range) || range <= 0) return 1;
  const magnitude = Math.floor(Math.log10(range));
  const candidates = [];
  for (let exp = magnitude - 3; exp <= magnitude + 1; exp++) {
    [1, 2, 4, 5, 8].forEach(m => candidates.push(m * Math.pow(10, exp)));
  }

  let best = candidates[0], bestScore = Infinity;
  candidates.forEach(step => {
    const bucketCount = Math.ceil(range / step);
    if (bucketCount < 1) return;
    const inSweetSpot = bucketCount >= 5 && bucketCount <= 7;
    const score = Math.abs(bucketCount - HIST_BUCKET_TARGET) - (inSweetSpot ? 0.5 : 0);
    if (score < bestScore) { bestScore = score; best = step; }
  });
  return best;
}

// 큰 수(매출액 등)는 천 단위 구분 기호를 붙여 가독성을 높인다.
function formatNumber(n) {
  const rounded = Math.round(n * 10) / 10;
  return rounded.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
}

function formatBucketNum(n, step) {
  // 구간 폭이 정수면 정수로, 소수면 소수 첫째 자리까지 표시. 큰 수는 천 단위 구분 기호 포함.
  const rounded = (step >= 1 && Number.isInteger(step)) ? Math.round(n) : Math.round(n * 10) / 10;
  return formatNumber(rounded);
}

// 값 목록을 5~7개 안팎의 구간(버킷)으로 묶는다.
function buildHistogramBuckets(vals) {
  const min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) return [{ label: formatBucketNum(min, 1), count: vals.length }];

  const step = niceStep(max - min);
  const start = Math.floor(min / step) * step;
  const bucketCount = Math.max(1, Math.ceil((max - start) / step));

  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    from: start + i * step, to: start + (i + 1) * step, count: 0
  }));
  vals.forEach(v => {
    let idx = Math.floor((v - start) / step);
    if (idx >= buckets.length) idx = buckets.length - 1;
    if (idx < 0) idx = 0;
    buckets[idx].count++;
  });
  return buckets.map(b => ({
    label: `${formatBucketNum(b.from, step)}~${formatBucketNum(b.to, step)}`,
    count: b.count
  }));
}

function renderBarRow(label, percentWidth, valueText, color) {
  return `<div class="bar-row">
    <div class="row-label">${label}</div>
    <div class="row-track"><div class="row-fill" style="width:${percentWidth}%;background:${color}"></div></div>
    <div class="row-value">${valueText}</div>
  </div>`;
}

// 예측 유도 문구 (범주형/수치형에 따라 다르게)
function guessPrompt(field) {
  if (field.type === 'category') {
    const opts = (field.order || []).slice(0, 4).join(' 아니면 ');
    return opts ? `${opts}, 어느 쪽이 더 많을까요?` : `어떤 게 더 많을까요?`;
  }
  return `평균이 얼마쯤 될까요?`;
}

// field에 대한 실제 집계 결과(HTML)를 만든다 — 클릭해서 공개될 때 채워지는 내용
function buildRevealHTML(field, unit) {
  const total = state.data.length;
  if (field.type === 'category') {
    const counts = {};
    state.data.forEach(d => { const v = d[field.key] || '미응답'; counts[v] = (counts[v] || 0) + 1; });
    const keys = (field.order || []).filter(k => counts[k] !== undefined)
      .concat(Object.keys(counts).filter(k => !(field.order || []).includes(k)));
    const top = keys.reduce((a, b) => (counts[a] || 0) >= (counts[b] || 0) ? a : b, keys[0]);
    return `
      <div class="overview-summary reveal-pop">${percent(counts[top] || 0, total)}%</div>
      <div class="overview-caption"> 이 자료에서는 <strong>${top}</strong>이(가) 가장 많아요!</div>
      ${keys.map((k, i) => renderBarRow(k, percent(counts[k], total), `${counts[k]}${unit} (${percent(counts[k], total)}%)`, PALETTE[i % PALETTE.length])).join('')}
    `;
  } else {
    const vals = state.data.map(d => Number(d[field.key]) || 0);
    const avgVal = total ? (vals.reduce((s, v) => s + v, 0) / total) : 0;
    const color = PALETTE[0];
    const uniqueCount = new Set(vals).size;

    let rows;
    if (uniqueCount > HIST_UNIQUE_THRESHOLD) {
      const buckets = buildHistogramBuckets(vals);
      const maxCount = Math.max(1, ...buckets.map(b => b.count));
      rows = buckets.map(b => renderBarRow(b.label, Math.round(b.count / maxCount * 100), `${b.count}${unit}`, color)).join('');
    } else {
      const buckets = {};
      vals.forEach(v => { buckets[v] = (buckets[v] || 0) + 1; });
      const sortedKeys = Object.keys(buckets).map(Number).sort((a, b) => a - b);
      const maxCount = Math.max(1, ...sortedKeys.map(k => buckets[k]));
      rows = sortedKeys.map(k => renderBarRow(formatNumber(k), Math.round(buckets[k] / maxCount * 100), `${buckets[k]}${unit}`, color)).join('');
    }

    const avgText = formatNumber(avgVal);
    const summaryClass = avgText.length > 9 ? 'overview-summary reveal-pop long' : 'overview-summary reveal-pop';

    return `
      <div class="${summaryClass}">${avgText}</div>
      <div class="overview-caption">평균 ${field.label}이에요</div>
      ${rows}
    `;
  }
}

function initOverview(container) {
  let cur = 0;

  function render() {
    const schema = state.schema;
    const unit = (typeof getUnitLabel === 'function') ? getUnitLabel(schema) : '건';
    const fields = schema ? getOverviewFields(schema) : [];
    if (!fields.length) {
      container.innerHTML = `<div class="match-empty">시각화할 수 있는 항목이 없어요. 데이터를 불러오면 자동으로 인식됩니다.</div>`;
      return;
    }
    if (cur >= fields.length) cur = 0;

    const field = fields[cur];
    container.innerHTML = `
      <div class="overview-card">
        <h2>${field.label}</h2>
        <div id="overviewBody" class="overview-body"></div>
        <div class="overview-nav">
          <button id="prev" class="btn secondary">◀ 이전</button>
          <span>${cur + 1} / ${fields.length}</span>
          <button id="next" class="btn secondary">다음 ▶</button>
        </div>
      </div>`;
    const body = container.querySelector('#overviewBody');

    // ── 카드를 열 때마다 항상 "잠긴 상태(예측 먼저)"로 시작한다 ──
    body.innerHTML = `
      <div class="reveal-card" id="revealCard">
        <div class="reveal-icon">🤔</div>
        <div class="reveal-prompt-text">${guessPrompt(field)}</div>
        <div class="reveal-cta">눌러서 결과 확인! 👀</div>
      </div>
    `;
    const revealCard = body.querySelector('#revealCard');
    revealCard.addEventListener('click', () => {
      if (!revealCard.classList.contains('reveal-card')) return; // 중복 클릭 방지
      revealCard.classList.remove('reveal-card');
      revealCard.classList.add('revealing');
      revealCard.querySelector('.reveal-cta').textContent = '두구두구... 🥁';
      sound.drumroll();
      setTimeout(() => {
        body.innerHTML = buildRevealHTML(field, unit);
      }, 900);
    });

    container.querySelector('#prev').addEventListener('click', () => { cur = (cur - 1 + fields.length) % fields.length; render() });
    container.querySelector('#next').addEventListener('click', () => { cur = (cur + 1) % fields.length; render() });
  }
  render();
  document.addEventListener('dataUpdated', () => render());
}
