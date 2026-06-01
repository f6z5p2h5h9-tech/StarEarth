/* ===== Course Map Logic ===== */
(function() {
  'use strict';

  // ---- Theme Toggle ----
  const themeBtn = document.getElementById('theme-toggle');
  const saved = localStorage.getItem('se-theme');
  if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
  themeBtn?.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    document.documentElement.setAttribute('data-theme', isLight ? '' : 'light');
    localStorage.setItem('se-theme', isLight ? 'dark' : 'light');
  });

  // ---- Constants ----
  const AGES = ['K', 'G1-G2', 'G3-G4', 'G5-G6'];
  const AGE_LABELS = ['K\n启蒙期', 'G1-G2\n探索期', 'G3-G4\n应用期', 'G5-G6\n创新期'];
  const MODULES = ['STEAM', '人文与思辨', '玩耍与体育', '自然与生活'];
  const MOD_ICONS = ['🔬', '📚', '⚽', '🌿'];
  const MOD_COLORS = [
    'rgba(78,205,196,0.15)',   // STEAM - earth teal
    'rgba(108,92,231,0.15)',   // 人文 - purple
    'rgba(225,112,85,0.15)',   // 体育 - orange
    'rgba(0,184,148,0.15)'    // 自然 - green
  ];
  const MOD_BORDER_COLORS = [
    'rgba(78,205,196,0.4)',
    'rgba(108,92,231,0.4)',
    'rgba(225,112,85,0.4)',
    'rgba(0,184,148,0.4)'
  ];
  const GRADE_SCORE = { A: 3, B: 2, C: 1 };

  // ---- Data ----
  let _cachedCourses = [];
  function getCourses() {
    return _cachedCourses;
  }

  function getReviewStatus(course) {
    if (!course.reviews || course.reviews.length === 0) return 'pending';
    const DIMS = [
      { key: 'd1', weight: 0.25 },
      { key: 'd2', weight: 0.25 },
      { key: 'd3', weight: 0.25 },
      { key: 'd4', weight: 0.15 },
      { key: 'd5', weight: 0.10 },
    ];
    const avgScores = DIMS.map(dim => {
      const scores = course.reviews.map(r => GRADE_SCORE[r.scores[dim.key]] || 0);
      return scores.reduce((a, b) => a + b, 0) / scores.length;
    });
    const allB = avgScores.every(s => s >= 2);
    const topThreeA = avgScores.slice(0, 3).filter(s => s >= 2.5).length >= 2;
    const anyFail = avgScores.slice(0, 3).some(s => s < 1.5);
    if (anyFail) return 'fail';
    if (allB && topThreeA) return 'pass';
    return 'review';
  }

  // ---- Build Matrix ----
  function buildMatrix() {
    const courses = getCourses();
    const matrix = {};
    let totalFilled = 0;

    AGES.forEach(age => {
      MODULES.forEach(mod => {
        const key = age + '|' + mod;
        const matched = courses.filter(c => c.age === age && c.module === mod);
        matrix[key] = matched;
        if (matched.length > 0) totalFilled++;
      });
    });

    return { matrix, courses, totalFilled };
  }

  // ---- Render Stats ----
  function renderStats(data) {
    const { courses, totalFilled } = data;
    const total = AGES.length * MODULES.length;
    const pct = Math.round(totalFilled / total * 100);
    const passed = courses.filter(c => getReviewStatus(c) === 'pass').length;

    document.getElementById('map-stats').innerHTML = `
      <div class="map-stat-item">
        <div class="map-stat-value">${courses.length}</div>
        <div class="map-stat-label">课程总数</div>
      </div>
      <div class="map-stat-item">
        <div class="map-stat-value">${totalFilled}<span class="map-stat-sub">/ ${total}</span></div>
        <div class="map-stat-label">已覆盖格子</div>
      </div>
      <div class="map-stat-item">
        <div class="map-stat-value">${pct}%</div>
        <div class="map-stat-label">覆盖率</div>
      </div>
      <div class="map-stat-item">
        <div class="map-stat-value">${passed}</div>
        <div class="map-stat-label">已通过评审</div>
      </div>
    `;
  }

  // ---- Render Matrix ----
  function renderMatrix(data) {
    const { matrix } = data;
    let html = '';

    // Corner cell
    html += `<div class="map-corner"></div>`;

    // Column headers (modules)
    MODULES.forEach((mod, mi) => {
      html += `<div class="map-col-header" style="border-bottom:3px solid ${MOD_BORDER_COLORS[mi]}">
        <span class="map-col-icon">${MOD_ICONS[mi]}</span>
        <span class="map-col-label">${mod}</span>
      </div>`;
    });

    // Rows
    AGES.forEach((age, ai) => {
      // Row header
      html += `<div class="map-row-header">${AGE_LABELS[ai].replace('\n', '<br>')}</div>`;

      // Cells
      MODULES.forEach((mod, mi) => {
        const key = age + '|' + mod;
        const courses = matrix[key];
        const count = courses.length;
        const hasPass = courses.some(c => getReviewStatus(c) === 'pass');
        const isEmpty = count === 0;

        let cellClass = 'map-cell';
        if (isEmpty) cellClass += ' map-cell-empty';
        if (hasPass) cellClass += ' map-cell-pass';

        let cellContent = '';
        if (isEmpty) {
          cellContent = `<span class="map-cell-empty-text">待开发</span>`;
        } else {
          const courseNames = courses.slice(0, 3).map(c => {
            const st = getReviewStatus(c);
            const dot = st === 'pass' ? '🟢' : st === 'review' ? '🟡' : st === 'fail' ? '🔴' : '⚪';
            return `<span class="map-cell-course">${dot} ${esc(c.name)}</span>`;
          }).join('');
          const more = count > 3 ? `<span class="map-cell-more">+${count - 3} 更多</span>` : '';
          cellContent = `
            <div class="map-cell-count">${count}</div>
            <div class="map-cell-courses">${courseNames}${more}</div>
          `;
        }

        html += `<div class="${cellClass}" data-age="${age}" data-mod="${mod}"
          style="--cell-bg:${isEmpty ? 'transparent' : MOD_COLORS[mi]};--cell-border:${MOD_BORDER_COLORS[mi]}"
          onclick="window.__showDetail('${age}','${mod}')">
          ${cellContent}
        </div>`;
      });
    });

    document.getElementById('map-matrix').innerHTML = html;
  }

  // ---- Show Detail Panel ----
  window.__showDetail = function(age, mod) {
    const courses = getCourses().filter(c => c.age === age && c.module === mod);
    const panel = document.getElementById('map-detail');
    const titleEl = document.getElementById('map-detail-title');
    const coursesEl = document.getElementById('map-detail-courses');

    const modIcons = { 'STEAM': '🔬', '人文与思辨': '📚', '玩耍与体育': '⚽', '自然与生活': '🌿' };
    titleEl.textContent = `${modIcons[mod] || ''} ${mod} · ${age}`;

    if (courses.length === 0) {
      coursesEl.innerHTML = `<div class="map-detail-empty">
        <p>这个维度还没有课程，<a href="course-submit.html">去提交一个 →</a></p>
      </div>`;
    } else {
      coursesEl.innerHTML = courses.map(c => {
        const st = getReviewStatus(c);
        const statusMap = {
          'pass': { label: '已通过', cls: 'score-pass' },
          'review': { label: '需修改', cls: 'score-review' },
          'fail': { label: '不通过', cls: 'score-fail' },
          'pending': { label: '待评审', cls: 'score-none' }
        };
        const s = statusMap[st];
        const date = new Date(c.submittedAt).toLocaleDateString('zh-CN');
        return `<div class="map-detail-course">
          <div class="map-detail-course-header">
            <strong>${esc(c.name)}</strong>
            <span class="course-score-badge ${s.cls}">${s.label}</span>
          </div>
          <div class="map-detail-course-meta">
            <span>👤 ${esc(c.teacher)}</span>
            <span>📅 ${date}</span>
            <span>⏱ ${esc(c.duration)}</span>
            <span>${esc(c.type)}</span>
          </div>
          ${c.driving ? `<p class="map-detail-eq">💡 ${esc(c.driving)}</p>` : ''}
        </div>`;
      }).join('');
    }

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  window.__closeDetail = function() {
    document.getElementById('map-detail').style.display = 'none';
  };

  // ---- Utils ----
  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Initial Render ----
  async function init() {
    try {
      if (window.StarEarthDB && window.StarEarthDB.isSupabaseReady()) {
        _cachedCourses = await window.StarEarthDB.getCourses();
      } else {
        _cachedCourses = JSON.parse(localStorage.getItem('se-courses') || '[]');
      }
    } catch (err) {
      console.warn('Failed to fetch courses from cloud, fallback to local', err);
      _cachedCourses = JSON.parse(localStorage.getItem('se-courses') || '[]');
    }
    const data = buildMatrix();
    renderStats(data);
    renderMatrix(data);
  }
  
  init();
})();
