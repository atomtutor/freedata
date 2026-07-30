// tab-match.js
function normalize(arr, field) {
  const vals = arr.map(d => Number(d[field]) || 0);
  const min = Math.min(...vals), max = Math.max(...vals);
  return vals.map(v => max === min ? 0.5 : (v - min) / (max - min));
}

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

function initMatch(container) {
  container.innerHTML = `
    <div class="match-intro">
      <button id="matchStart" class="btn">매칭 시작!</button>
    </div>
    <div id="matchResult" class="match-list"></div>
  `;
  const start = container.querySelector('#matchStart');
  const out = container.querySelector('#matchResult');

  start.addEventListener('click', () => {
    const schema = state.schema;
    const unit = (typeof getUnitLabel === 'function') ? getUnitLabel(schema) : '건';
    const numericKeys = (schema && schema.numeric) || [];
    if (numericKeys.length < 1) { out.innerHTML = `<div class="match-empty">닮은꼴을 계산할 수치형 항목이 없어요.</div>`; return; }
    if (state.data.length < 2) { out.innerHTML = `<div class="match-empty">응답이 부족합니다. (2${unit} 이상 필요)</div>`; return; }

    start.disabled = true;
    sound.shuffle(); // 매칭 계산 중인 느낌의 효과음

    const normColumns = numericKeys.map(k => normalize(state.data, k));
    const norms = state.data.map((d, i) => ({
      nickname: d.__label || '익명',
      vec: normColumns.map(col => col[i])
    }));

    const pairs = [];
    for (let i = 0; i < norms.length; i++) {
      for (let j = i + 1; j < norms.length; j++) {
        const a = norms[i].vec, b = norms[j].vec;
        const dist = Math.sqrt(a.reduce((s, v, idx) => s + Math.pow(v - b[idx], 2), 0));
        pairs.push({ i, j, dist });
      }
    }
    pairs.sort((a, b) => a.dist - b.dist);
    const top3 = pairs.slice(0, 3);

    out.innerHTML = '';
    setTimeout(() => {
      out.innerHTML =
        `<div class="match-hint">순위 카드를 하나씩 눌러서 확인해보세요! 👇</div>` +
        top3.map((p, idx) => `
          <div class="match-card locked" data-rank="${idx}">
            <div class="match-rank">${RANK_EMOJI[idx]}</div>
            <div class="match-names">눌러서 확인! 👀</div>
            <div class="match-dist"></div>
          </div>`).join('');

      out.querySelectorAll('.match-card.locked').forEach(card => {
        card.addEventListener('click', () => {
          if (!card.classList.contains('locked')) return; // 중복 클릭 방지
          const idx = Number(card.dataset.rank);
          const p = top3[idx];
          const a = norms[p.i].nickname, b = norms[p.j].nickname;
          const isFirst = idx === 0;

          card.classList.remove('locked');
          card.classList.add('revealing');
          card.querySelector('.match-names').textContent = '두구두구... 🥁';

          if (isFirst) sound.fanfare(); else sound.suspense();
          const delay = isFirst ? 1100 : 1500;

          setTimeout(() => {
            card.classList.remove('revealing');
            card.classList.add('revealed');
            card.querySelector('.match-names').innerHTML = `<span class="match-heart">❤</span> ${a} &nbsp;·&nbsp; ${b} <span class="match-heart">❤</span>`;
            card.querySelector('.match-dist').textContent = `거리 ${p.dist.toFixed(3)}`;

            if (isFirst) {
              card.classList.add('rank1');
              const layer = document.createElement('div');
              layer.className = 'confetti-layer';
              card.appendChild(layer);
              spawnConfetti(layer); // tab-battle.js 의 전역 함수 재사용
            }
          }, delay);
        });
      });
    }, 700);
  });
}
