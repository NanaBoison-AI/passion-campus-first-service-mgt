import { h, empty, toast, clear } from '../lib/dom.js';
import { setAppbar } from '../lib/ui.js';
import { getGroup } from '../lib/store.js';
import { listServices } from '../api/attendance.js';
import { todayKey, monthShort } from '../lib/format.js';
import {
  Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Title
} from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Title);

export async function renderGraphs({ groupId }) {
  const g = await getGroup(groupId);
  setAppbar('Graphs', { sub: g ? g.name : '', backHash: `#/g/${encodeURIComponent(groupId)}` });

  let mode = 'daily';
  const controls = h('div', {});
  const chartCard = h('div', { class: 'card' }, h('div', { class: 'chart-wrap' }, h('canvas')));
  let chart = null;

  const seg = h('div', { class: 'seg mb' }, [
    segBtn('daily', 'Per day (range)'),
    segBtn('monthly', 'Monthly avg (year)')
  ]);
  function segBtn(key, label) {
    return h('button', { class: mode === key ? 'on' : '', onClick: () => { mode = key; paintSeg(); renderControls(); } }, label);
  }
  function paintSeg() {
    [...seg.children].forEach((b, i) => b.classList.toggle('on', (i === 0 ? 'daily' : 'monthly') === mode));
  }

  function canvas() { return chartCard.querySelector('canvas'); }
  function draw(labels, data, title, color = '#4f46e5') {
    if (chart) chart.destroy();
    if (!data.length || data.every((v) => v === 0)) {
      clear(chartCard); chartCard.append(empty('No attendance data for this selection.'));
      return;
    }
    if (!chartCard.querySelector('canvas')) { clear(chartCard); chartCard.append(h('div', { class: 'chart-wrap' }, h('canvas'))); }
    chart = new Chart(canvas(), {
      type: 'bar',
      data: { labels, datasets: [{ label: title, data, backgroundColor: color, borderRadius: 6, maxBarThickness: 46 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, title: { display: true, text: title } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } }
      }
    });
  }

  // ---- Daily (range) ----
  function dailyControls() {
    const start = h('input', { class: 'input', type: 'date' });
    const end = h('input', { class: 'input', type: 'date', value: todayKey() });
    const go = h('button', { class: 'btn primary block', onClick: async () => {
      if (!start.value || !end.value) { toast('Pick a start and end date', 'err'); return; }
      go.disabled = true;
      try {
        const services = await listServices(groupId, start.value, end.value);
        draw(services.map((s) => prettyLabel(s.date)), services.map((s) => s.count),
          `Total attendance per day`);
      } catch (e) { toast(e.message, 'err'); } finally { go.disabled = false; }
    } }, 'Show chart');
    return h('div', { class: 'card' }, [
      h('div', { class: 'row-2 mb' }, [
        h('label', { class: 'field' }, [h('span', {}, 'From'), start]),
        h('label', { class: 'field' }, [h('span', {}, 'To'), end])
      ]),
      go
    ]);
  }

  // ---- Monthly average (year) ----
  function monthlyControls() {
    const yearNow = new Date().getFullYear();
    const year = h('input', { class: 'input', type: 'number', value: String(yearNow), min: '2000', max: '2100' });
    const go = h('button', { class: 'btn primary block', onClick: async () => {
      go.disabled = true;
      try {
        const y = year.value;
        const services = await listServices(groupId, `${y}-01-01`, `${y}-12-31`);
        const sum = Array(12).fill(0), days = Array(12).fill(0);
        services.forEach((s) => { const mi = Number(s.date.slice(5, 7)) - 1; sum[mi] += s.count; days[mi] += 1; });
        const avg = sum.map((t, i) => (days[i] ? Math.round(t / days[i]) : 0));
        draw(monthLabels(), avg, `Average attendance per service · ${y}`, '#0ea5e9');
      } catch (e) { toast(e.message, 'err'); } finally { go.disabled = false; }
    } }, 'Show chart');
    return h('div', { class: 'card' }, [
      h('label', { class: 'field' }, [h('span', {}, 'Year'), year]),
      go
    ]);
  }

  function renderControls() {
    clear(controls);
    controls.append(mode === 'daily' ? dailyControls() : monthlyControls());
    if (chart) { chart.destroy(); chart = null; }
    clear(chartCard);
    chartCard.append(empty('Choose a range and tap “Show chart”.'));
  }

  renderControls();
  return h('div', {}, [seg, controls, chartCard]);
}

const monthLabels = () => Array.from({ length: 12 }, (_, i) => monthShort(i));
const prettyLabel = (key) => { const [, m, d] = key.split('-'); return `${d} ${monthShort(Number(m) - 1)}`; };
