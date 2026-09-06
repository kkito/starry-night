import { computeSky, computeTrack } from './core';

const form = document.getElementById('f') as HTMLFormElement;
const summary = document.getElementById('summary')!;
const table = document.getElementById('tbl') as HTMLTableElement;
const tbody = table.querySelector('tbody')!;
const MAX_ROWS = 200;

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const lat = Number((document.getElementById('lat') as HTMLInputElement).value);
  const lon = Number((document.getElementById('lon') as HTMLInputElement).value);
  const mag = Number((document.getElementById('mag') as HTMLInputElement).value) || 5.0;
  const dateLocal = (document.getElementById('date') as HTMLInputElement).value;
  let date: Date;
  try {
    date = new Date(`${dateLocal}:00Z`); // 输入框按 UTC 解释
    const { lstDeg, stars } = computeSky({ lat, lon, date, magLimit: mag });
    summary.textContent = `LAST ${lstDeg.toFixed(2)}° · 可见星 ${stars.length} 颗（显示前 ${Math.min(stars.length, MAX_ROWS)}）`;
    tbody.innerHTML = stars
      .slice(0, MAX_ROWS)
      .map(
        (s) =>
          `<tr><td>${s.name ?? s.id}</td><td>${s.mag.toFixed(2)}</td><td>${s.alt.toFixed(2)}</td>` +
          `<td>${s.az.toFixed(2)}</td><td>${s.ra.toFixed(3)}</td><td>${s.dec.toFixed(3)}</td></tr>`,
      )
      .join('');
    table.hidden = false;
  } catch (err) {
    summary.textContent = `错误：${err instanceof Error ? err.message : String(err)}`;
    table.hidden = true;
  }
});

// 轨迹 API 先暴露给控制台，UI 后续再做
Object.assign(window, { __starDemo: { computeSky, computeTrack } });
