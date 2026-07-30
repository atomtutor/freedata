// tab-overview.js
function percent(count, total) { return total ? Math.round(count / total * 100) : 0 }

function getOverviewFields(schema) {
  const fields = [];
  (schema.categorical || []).forEach(c => fields.push({ key: c.key, label: c.key, type: 'category', order: c.values }));
  (schema.numeric || []).forEach(k => fields.push({ key: k, label: k, type: 'numeric' }));
  return fields;
}

const PALETTE = ['var(--pink)', 'var(--teal)'];

function renderBarRow(label, percentWidth, valueText, color) {
  return `<div class="bar-row">
    <div class="row-label">${label}</div>
    <div class="row-track"><div class="row-fill" style="width:${percentWidth}%;background:${color}"></div></div>
    <div class="row-value">${valueText}</div>
  </div>`;
}

function initOverview(container) {
  let cur = 0;

  function render() {
    const schema = state.schema;
    const fields = schema ? getOverviewFields(schema) : [];
    if (!fields.length) {
      container.innerHTML = `<div class="match-empty">시각화할 수 있는 항목이 없어요. 데이터를 불러오면 자동으로 인식됩니다.</div>`;
      return;
    }
    if (cur >= fields.length) cur = 0;

    const field = fields[cur];
    const total = state.data.length;
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

    if (field.type === 'category') {
      const counts = {};
      state.data.forEach(d => { const v = d[field.key] || '미응답'; counts[v] = (counts[v] || 0) + 1; });
      const keys = (field.order || []).filter(k => counts[k] !== undefined)
        .concat(Object.keys(counts).filter(k => !(field.order || []).includes(k)));
      const top = keys.reduce((a, b) => (counts[a] || 0) >= (counts[b] || 0) ? a : b, keys[0]);
      body.innerHTML = `
        <div class="overview-summary">${percent(counts[top] || 0, total)}%</div>
        <div class="overview-caption"> 이 자료에서는 <strong>${top}</strong>이(가) 가장 많아요!</div>
        ${keys.map((k, i) => renderBarRow(k, percent(counts[k], total), `${counts[k]}건 (${percent(counts[k], total)}%)`, PALETTE[i % PALETTE.length])).join('')}
      `;
    } else {
      const vals = state.data.map(d => Number(d[field.key]) || 0);
      const avgVal = total ? (vals.reduce((s, v) => s + v, 0) / total) : 0;
      const buckets = {};
      vals.forEach(v => { buckets[v] = (buckets[v] || 0) + 1; });
      const sortedKeys = Object.keys(buckets).map(Number).sort((a, b) => a - b);
      const maxCount = Math.max(1, ...sortedKeys.map(k => buckets[k]));
      const color = PALETTE[cur % PALETTE.length];

      body.innerHTML = `
        <div class="overview-summary">${avgVal.toFixed(1)}</div>
        <div class="overview-caption">평균 ${field.label}이에요</div>
        ${sortedKeys.map(k => renderBarRow(`${k}`, Math.round(buckets[k] / maxCount * 100), `${buckets[k]}건`, color)).join('')}
      `;
    }

    container.querySelector('#prev').addEventListener('click', () => { cur = (cur - 1 + fields.length) % fields.length; render() });
    container.querySelector('#next').addEventListener('click', () => { cur = (cur + 1) % fields.length; render() });
  }
  render();
  document.addEventListener('dataUpdated', () => render());
}
