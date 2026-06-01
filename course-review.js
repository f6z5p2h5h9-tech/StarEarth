/* ===== Course Review Logic ===== */
/* 已升级：通过 StarEarthDB 数据层读取/提交评审，支持 Supabase 云端 + localStorage 降级 */
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

  // ---- Dimensions config ----
  const DIMS = [
    { key: 'd1', label: '教育目标对齐度', weight: 0.25 },
    { key: 'd2', label: 'PBL方法论落实度', weight: 0.25 },
    { key: 'd3', label: '教育过程原则践行度', weight: 0.25 },
    { key: 'd4', label: '年龄适配度与内容质量', weight: 0.15 },
    { key: 'd5', label: '教案完整性与可操作性', weight: 0.10 },
  ];
  const GRADE_SCORE = { A: 3, B: 2, C: 1 };
  const WEIGHT_LABELS = ['25%', '25%', '25%', '15%', '10%'];

  // ---- Connection Status Badge ----
  function showConnectionStatus() {
    const isCloud = window.StarEarthDB && window.StarEarthDB.isSupabaseReady();
    document.querySelector('.connection-badge')?.remove();
    const badge = document.createElement('div');
    badge.className = 'connection-badge ' + (isCloud ? 'cloud' : 'local');
    badge.innerHTML = isCloud
      ? '☁️ 云端同步已启用 · 数据实时共享'
      : '💾 本地模式（数据仅存储在此设备）';
    const main = document.querySelector('.page-main');
    if (main) main.insertBefore(badge, main.firstChild.nextSibling?.nextSibling);
  }
  // Delay to allow Supabase CDN script to finish loading
  setTimeout(showConnectionStatus, 500);

  // ---- Data Access Layer ----
  // Unified interface that works with both Supabase and localStorage data formats

  /**
   * Load courses — handles both Supabase and localStorage formats
   * Returns normalized course array
   */
  async function loadCourses() {
    if (window.StarEarthDB) {
      try {
        const data = await window.StarEarthDB.getCourses();
        // Normalize Supabase format to match the rendering expectations
        return data.map(normalizeCourse);
      } catch (err) {
        console.warn('Supabase 加载失败，降级为 localStorage:', err.message);
      }
    }
    // Fallback to localStorage
    return JSON.parse(localStorage.getItem('se-courses') || '[]');
  }

  /**
   * Normalize Supabase course object to the flat format used by the renderer
   * Supabase returns nested relations; localStorage uses a flat structure
   */
  function normalizeCourse(course) {
    // If the course has a teacher object (Supabase format), extract teacher name
    if (course.teacher && typeof course.teacher === 'object') {
      course.teacherName = course.teacher.name;
      course.teacherId = course.teacher.id;
    }

    // Map Supabase column names to frontend field names
    const normalized = {
      id: course.id,
      name: course.name,
      module: course.module,
      age: course.age_group || course.age,
      type: course.course_type || course.type,
      duration: course.duration,
      teacher: course.teacherName || course.teacher || '',
      ability: course.ability,
      alignment: course.alignment,
      diff: course.diff_from_school || course.diff,
      driving: course.driving_question || course.driving,
      dualTrack: course.is_dual_track ?? course.dualTrack ?? false,
      // Dual-track fields
      steamKnowledge: course.steam_knowledge || course.steamKnowledge || '',
      steamHandson: course.steam_handson || course.steamHandson || '',
      steamSolution: course.steam_solution || course.steamSolution || '',
      humInquiry: course.hum_inquiry || course.humInquiry || '',
      humDiscussion: course.hum_discussion || course.humDiscussion || '',
      humResource: course.hum_resource || course.humResource || '',
      convergence: course.convergence || '',
      // Single-track fields
      knowledge: course.knowledge || '',
      solution: course.solution || '',
      handson: course.handson || '',
      // Shared
      reflect: course.reflect || '',
      safety: course.safety || '',
      submittedAt: course.submitted_at || course.submittedAt,
      // Steps
      steps: normalizeSteps(course.steps),
      // Materials
      materials: normalizeMaterials(course.materials),
      // Reviews
      reviews: normalizeReviews(course.reviews),
      // Sport-specific fields (pass through)
      isSportsCourse: course.isSportsCourse || false,
      sportStudents: course.sportStudents || '',
      sportDate: course.sportDate || '',
      sportVenue: course.sportVenue || '',
      sportEquipment: course.sportEquipment || [],
      sportTheme: course.sportTheme || '',
      sportGoals: course.sportGoals || '',
      sportTransfer: course.sportTransfer || '',
      sportPhases: course.sportPhases || [],
      sportSafety: course.sportSafety || '',
      sportDiff: course.sportDiff || '',
    };

    return normalized;
  }

  function normalizeSteps(steps) {
    if (!steps || !Array.isArray(steps)) return [];
    return steps.map(s => ({
      duration: s.duration,
      content: s.content,
    }));
  }

  function normalizeMaterials(materials) {
    if (!materials) return [];
    // If it's already an array of { name, qty } objects, return as-is
    if (Array.isArray(materials)) return materials;
    // If it's a JSON string, parse it
    if (typeof materials === 'string') {
      try {
        const parsed = JSON.parse(materials);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Treat as plain text
        return materials;
      }
    }
    return materials;
  }

  function normalizeReviews(reviews) {
    if (!reviews || !Array.isArray(reviews)) return [];
    return reviews.map(r => {
      // Supabase format: reviewer is an object, scores is an array of { dimension_key, grade }
      if (r.reviewer && typeof r.reviewer === 'object') {
        const scores = {};
        if (Array.isArray(r.scores)) {
          r.scores.forEach(s => {
            scores[s.dimension_key] = s.grade;
          });
        }
        return {
          reviewer: r.reviewer.name,
          scores: scores,
          comment: r.comment || '',
          date: r.created_at,
        };
      }
      // localStorage format: already flat
      return r;
    });
  }

  /**
   * Submit review — uses StarEarthDB if available
   */
  async function submitReviewData(courseId, reviewData, courseIndex) {
    if (window.StarEarthDB && window.StarEarthDB.isSupabaseReady()) {
      await window.StarEarthDB.createReview(courseId, reviewData);
    } else {
      // localStorage fallback
      const courses = JSON.parse(localStorage.getItem('se-courses') || '[]');
      if (!courses[courseIndex]) throw new Error('课程不存在');
      if (!courses[courseIndex].reviews) courses[courseIndex].reviews = [];
      courses[courseIndex].reviews.push({
        reviewer: reviewData.reviewer,
        scores: reviewData.scores,
        comment: reviewData.comment,
        date: new Date().toISOString()
      });
      localStorage.setItem('se-courses', JSON.stringify(courses));
    }
  }

  // ---- Current courses cache ----
  let currentCourses = [];

  // ---- Render ----
  const listEl = document.getElementById('course-list');
  const loadingEl = document.getElementById('loading-state');

  async function render() {
    // Show loading state
    if (loadingEl) loadingEl.style.display = 'flex';
    listEl.innerHTML = '';

    try {
      currentCourses = await loadCourses();
    } catch (err) {
      console.error('加载课程失败:', err);
      currentCourses = [];
    }

    // Hide loading state
    if (loadingEl) loadingEl.style.display = 'none';

    if (currentCourses.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h3>还没有提交的课程</h3>
          <p>教师提交课程方案后，会在这里显示。<br><a href="course-submit.html" style="color:var(--accent-earth)">去提交一个课程 →</a></p>
        </div>`;
      return;
    }
    listEl.innerHTML = currentCourses.map((c, i) => renderCourse(c, i)).join('');

    // Auto-fill reviewer name from identity
    if (window.StarEarthIdentity) {
      const identity = window.StarEarthIdentity.getSavedIdentity();
      if (identity) {
        document.querySelectorAll('.review-name').forEach(input => {
          if (!input.value) input.value = identity.name;
        });
      }
    }
  }

  function renderCourse(course, index) {
    const date = new Date(course.submittedAt).toLocaleDateString('zh-CN');
    const scoreBadge = getScoreBadge(course);
    const dualBadge = course.dualTrack ? '<span class="course-tag tag-dual">双线并行</span>' : '';
    
    return `
    <div class="course-card" data-index="${index}" id="course-${index}">
      <div class="course-card-header" onclick="toggleCourse(${index})">
        <div class="course-meta">
          <span class="course-name">${esc(course.name)}</span>
          <div class="course-tags">
            <span class="course-tag tag-module">${esc(course.module)}</span>
            <span class="course-tag tag-age">${esc(course.age)}</span>
            <span class="course-tag tag-type">${esc(course.type)}</span>
            ${dualBadge}
          </div>
        </div>
        ${scoreBadge}
        <svg class="course-expand-icon" viewBox="0 0 24 24" width="20" height="20"><polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2"/></svg>
      </div>
      <div class="course-card-body">
        <!-- Detail -->
        <div class="course-detail">
          ${course.isSportsCourse ? renderSportDetail(course, date) : renderPBLDetail(course, date)}

          <!-- Course Actions -->
          <div class="course-actions">
            <button type="button" class="course-action-btn action-edit" onclick="event.stopPropagation();editCourse(${index})" title="编辑课程">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              编辑课程
            </button>
            <button type="button" class="course-action-btn action-delete" onclick="event.stopPropagation();deleteCourseConfirm(${index})" title="删除课程">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              删除
            </button>
          </div>
        </div>

        <!-- Reviews -->
        <div class="review-panel">
          <div class="review-panel-title">📊 评审打分</div>
          ${renderReviewSummary(course)}
          ${renderReviewHistory(course)}
          ${renderNewReviewForm(index)}
        </div>
      </div>
    </div>`;
  }

  function renderPBLDetail(course, date) {
    return `
      <div class="detail-grid">
        <div class="detail-section"><div class="detail-label">开发教师</div><div class="detail-text">${esc(course.teacher)}</div></div>
        <div class="detail-section"><div class="detail-label">提交时间 / 时长</div><div class="detail-text">${date} · ${esc(course.duration)}</div></div>
      </div>
      <div class="detail-section"><div class="detail-label">能力目标</div><div class="detail-text">${esc(course.ability)}</div></div>
      <div class="detail-section"><div class="detail-label">与总目标的对齐</div><div class="detail-text">${esc(course.alignment)}</div></div>
      <div class="detail-section"><div class="detail-label">与学校教育的差异化</div><div class="detail-text">${esc(course.diff)}</div></div>
      <div class="detail-section"><div class="detail-label">驱动问题</div><div class="detail-text" style="font-weight:500;color:var(--accent-star)">${esc(course.driving)}</div></div>
      ${renderPBLSection(course)}
      <div class="detail-section"><div class="detail-label">展示与反思</div><div class="detail-text">${esc(course.reflect)}</div></div>
      ${renderSteps(course.steps)}
      <div class="detail-section"><div class="detail-label">材料清单</div><div class="detail-text">${renderMaterials(course.materials)}</div></div>
      ${course.safety ? `<div class="detail-section"><div class="detail-label">安全注意事项</div><div class="detail-text">${esc(course.safety)}</div></div>` : ''}`;
  }

  function renderSportDetail(course, date) {
    const eqHtml = Array.isArray(course.sportEquipment) && course.sportEquipment.length > 0
      ? course.sportEquipment.map(e => `<li>${esc(e.name)}${e.qty ? ' × ' + esc(e.qty) : ''}</li>`).join('')
      : '<li>无</li>';
    const phasesHtml = Array.isArray(course.sportPhases) && course.sportPhases.length > 0
      ? course.sportPhases.map((p, i) => {
        const typeLabels = { warmup: '🔥 热身', main: '📘 主课', play: '🎮 自由玩耍', cooldown: '💧 放松' };
        const typeLabel = typeLabels[p.phaseType] || p.phaseType;
        return `
          <div class="sport-phase-card phase-type-${p.phaseType || 'main'}" style="margin-bottom:10px">
            <div class="sport-phase-header" style="margin-bottom:8px">
              <span class="sport-phase-number">${i+1}</span>
              <strong>${typeLabel}</strong>
              <span style="color:var(--text-muted);font-size:13px">${esc(p.phaseDuration || '')}</span>
            </div>
            <div class="detail-grid" style="gap:8px">
              <div class="detail-section"><div class="detail-label">练习/游戏</div><div class="detail-text">${esc(p.gameName || '—')}</div></div>
              <div class="detail-section"><div class="detail-label">组织形式</div><div class="detail-text">${esc(p.formation || '—')}</div></div>
            </div>
            ${p.coaching ? `<div class="detail-section" style="margin-top:6px"><div class="detail-label">指导要点</div><div class="detail-text">${esc(p.coaching)}</div></div>` : ''}
            ${p.diagram ? `<div class="detail-section" style="margin-top:6px"><div class="detail-label">图示</div><div class="detail-text" style="white-space:pre-wrap;font-family:monospace;font-size:13px">${esc(p.diagram)}</div></div>` : ''}
          </div>`;
      }).join('')
      : '<p style="color:var(--text-muted)">暂无教学环节</p>';

    return `
      <div class="detail-grid">
        <div class="detail-section"><div class="detail-label">开发教师</div><div class="detail-text">${esc(course.teacher)}</div></div>
        <div class="detail-section"><div class="detail-label">提交时间 / 时长</div><div class="detail-text">${date} · ${esc(course.duration)}</div></div>
      </div>
      <div class="detail-grid">
        <div class="detail-section"><div class="detail-label">学生人数</div><div class="detail-text">${esc(course.sportStudents || '—')}</div></div>
        <div class="detail-section"><div class="detail-label">场地</div><div class="detail-text">${esc(course.sportVenue || '—')}</div></div>
      </div>
      ${course.sportDate ? `<div class="detail-section"><div class="detail-label">上课日期</div><div class="detail-text">${esc(course.sportDate)}</div></div>` : ''}
      <div class="detail-section"><div class="detail-label">器材清单</div><div class="detail-text"><ul style="margin:0;padding-left:18px">${eqHtml}</ul></div></div>
      <div class="detail-section"><div class="detail-label" style="font-weight:600;color:var(--accent-star)">⚽ 课程主题</div><div class="detail-text" style="font-weight:500">${esc(course.sportTheme || '—')}</div></div>
      <div class="detail-section"><div class="detail-label">课程目标</div><div class="detail-text">${esc(course.sportGoals || '—')}</div></div>
      ${course.sportTransfer ? `<div class="detail-section"><div class="detail-label">专项迁移性</div><div class="detail-text">${esc(course.sportTransfer)}</div></div>` : ''}
      <div class="detail-section"><div class="detail-label" style="font-weight:600">⏱️ 教学流程</div></div>
      ${phasesHtml}
      ${course.sportSafety ? `<div class="detail-section"><div class="detail-label">🛡️ 安全注意事项</div><div class="detail-text">${esc(course.sportSafety)}</div></div>` : ''}
      ${course.sportDiff ? `<div class="detail-section"><div class="detail-label">分层难度设计</div><div class="detail-text">${esc(course.sportDiff)}</div></div>` : ''}`;
  }

  function renderPBLSection(course) {
    if (course.dualTrack) {
      return `
        <div class="detail-dual-track">
          <div class="detail-track detail-track-steam">
            <div class="detail-track-title">🔬 STEAM 探索线</div>
            <div class="detail-section">
              <div class="detail-label">探索与知识构建</div>
              <div class="detail-text">${esc(course.steamKnowledge)}</div>
            </div>
            <div class="detail-section">
              <div class="detail-label">动手实践</div>
              <div class="detail-text">${esc(course.steamHandson)}</div>
            </div>
            ${course.steamSolution ? `<div class="detail-section"><div class="detail-label">方案设计引导</div><div class="detail-text">${esc(course.steamSolution)}</div></div>` : ''}
          </div>
          <div class="detail-track detail-track-hum">
            <div class="detail-track-title">📚 人文思辨线</div>
            <div class="detail-section">
              <div class="detail-label">探究与思辨</div>
              <div class="detail-text">${esc(course.humInquiry)}</div>
            </div>
            <div class="detail-section">
              <div class="detail-label">讨论与表达</div>
              <div class="detail-text">${esc(course.humDiscussion)}</div>
            </div>
            ${course.humResource ? `<div class="detail-section"><div class="detail-label">资源支架</div><div class="detail-text">${esc(course.humResource)}</div></div>` : ''}
          </div>
        </div>
        <div class="detail-convergence">
          <div class="detail-label">🔄 双线汇合</div>
          <div class="detail-text">${esc(course.convergence)}</div>
        </div>`;
    }
    // Single track (backward compatible)
    return `
      <div class="detail-grid">
        <div class="detail-section">
          <div class="detail-label">知识构建安排</div>
          <div class="detail-text">${esc(course.knowledge)}</div>
        </div>
        <div class="detail-section">
          <div class="detail-label">方案设计引导</div>
          <div class="detail-text">${esc(course.solution || '（未填写）')}</div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-label">动手实践</div>
        <div class="detail-text">${esc(course.handson)}</div>
      </div>`;
  }

  function renderSteps(steps) {
    if (!steps || steps.length === 0) return '';
    return `<div class="detail-section">
      <div class="detail-label">教学流程</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
        ${steps.map((s, i) => `
          <div style="display:flex;gap:10px;background:var(--bg);padding:10px 14px;border-radius:8px;font-size:0.85rem">
            <span style="color:var(--accent-earth);font-weight:600;white-space:nowrap">⏱ ${esc(s.duration)}</span>
            <span style="color:var(--text);line-height:1.6">${esc(s.content)}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  function renderMaterials(materials) {
    // New format: array of { name, qty }
    if (Array.isArray(materials)) {
      if (materials.length === 0) return '（未填写）';
      return materials.map(m =>
        `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;font-size:0.85rem">` +
        `<span style="color:var(--accent-earth)">•</span> ` +
        `<span>${esc(m.name)}</span>` +
        (m.qty ? `<span style="color:var(--text-muted);margin-left:4px">× ${esc(m.qty)}</span>` : '') +
        `</div>`
      ).join('');
    }
    // Legacy format: plain string
    return esc(materials);
  }

  function renderReviewSummary(course) {
    if (!course.reviews || course.reviews.length === 0) return '';
    
    // Compute average per dimension
    const avgScores = DIMS.map((dim, di) => {
      const scores = course.reviews.map(r => GRADE_SCORE[r.scores[dim.key]] || 0);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return { dim, avg };
    });
    
    const weightedTotal = avgScores.reduce((sum, { dim, avg }) => sum + avg * dim.weight, 0);
    const maxScore = 3;
    const pct = (weightedTotal / maxScore * 100).toFixed(0);
    
    // Determine result
    const allB = avgScores.every(s => s.avg >= 2);
    const topThreeA = avgScores.slice(0, 3).filter(s => s.avg >= 2.5).length >= 2;
    const anyFail = avgScores.slice(0, 3).some(s => s.avg < 1.5);
    
    let result, resultClass;
    if (anyFail) { result = '不通过'; resultClass = 'score-fail'; }
    else if (allB && topThreeA) { result = '通过'; resultClass = 'score-pass'; }
    else { result = '需修改'; resultClass = 'score-review'; }

    return `<div class="review-summary">
      <div class="summary-scores">
        ${avgScores.map(({ dim, avg }) => {
          const grade = avg >= 2.5 ? 'A' : avg >= 1.5 ? 'B' : 'C';
          const color = avg >= 2.5 ? 'var(--excellent)' : avg >= 1.5 ? '#c9971a' : 'var(--fail)';
          return `<div class="summary-dim">
            <div class="summary-dim-label">${dim.label.substring(0, 4)}</div>
            <div class="summary-dim-value" style="color:${color}">${grade}</div>
          </div>`;
        }).join('')}
      </div>
      <div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;text-align:center">${course.reviews.length}人评审 · 加权${pct}分</div>
        <div class="summary-result ${resultClass}">${result}</div>
      </div>
    </div>`;
  }

  function renderReviewHistory(course) {
    if (!course.reviews || course.reviews.length === 0) {
      return '<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:20px">暂无评审记录，请在下方提交评价。</p>';
    }
    return `<div class="review-history">
      ${course.reviews.map(r => {
        const date = new Date(r.date).toLocaleDateString('zh-CN');
        return `<div class="review-entry">
          <div class="review-entry-header">
            <span class="reviewer-name">👤 ${esc(r.reviewer)}</span>
            <span class="review-date">${date}</span>
          </div>
          <div class="review-scores">
            ${DIMS.map(dim => {
              const grade = r.scores[dim.key];
              const cls = grade === 'A' ? 'grade-a' : grade === 'B' ? 'grade-b' : 'grade-c';
              return `<span class="review-score-chip ${cls}">${dim.label.substring(0, 4)}：${grade}</span>`;
            }).join('')}
          </div>
          ${r.comment ? `<div class="review-comment">💬 ${esc(r.comment)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  function renderNewReviewForm(index) {
    return `<div class="new-review" data-course-index="${index}">
      <h4>➕ 提交新评价</h4>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">评价人姓名 <span class="required">*</span></label>
        <input type="text" class="form-input review-name" placeholder="填写你的姓名" style="max-width:280px">
      </div>
      <div class="score-dimensions">
        ${DIMS.map((dim, di) => `
          <div class="score-dim-row">
            <span class="score-dim-label">${dim.label}<span class="dim-weight">${WEIGHT_LABELS[di]}</span></span>
            <div class="score-btn-group" data-dim="${dim.key}">
              <button type="button" class="score-btn" data-grade="A" onclick="selectGrade(this)">优秀 A</button>
              <button type="button" class="score-btn" data-grade="B" onclick="selectGrade(this)">合格 B</button>
              <button type="button" class="score-btn" data-grade="C" onclick="selectGrade(this)">不合格 C</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">评语（可选）</label>
        <textarea class="form-textarea review-comment" placeholder="对课程设计的整体评价和建议..." style="min-height:70px"></textarea>
      </div>
      <button type="button" class="btn-submit-review" onclick="submitReview(${index})">提交评价</button>
    </div>`;
  }

  // ---- Score Selection ----
  window.selectGrade = function(btn) {
    const group = btn.parentElement;
    group.querySelectorAll('.score-btn').forEach(b => {
      b.className = 'score-btn';
    });
    const grade = btn.dataset.grade;
    btn.classList.add('selected-' + grade.toLowerCase());
  };

  // ---- Toggle Course Card ----
  window.toggleCourse = function(index) {
    const card = document.getElementById('course-' + index);
    card.classList.toggle('expanded');
  };

  // ---- Edit Course ----
  window.editCourse = function(index) {
    const course = currentCourses[index];
    if (!course) return;
    // Store the course data in sessionStorage for the edit page to pick up
    sessionStorage.setItem('se-edit-course', JSON.stringify(course));
    window.location.href = 'course-submit.html?edit=' + encodeURIComponent(course.id);
  };

  // ---- Delete Course (custom modal, no confirm()) ----
  let pendingDeleteIndex = -1;
  const deleteModal = document.getElementById('delete-modal');
  const deleteModalText = document.getElementById('delete-modal-text');
  const deleteConfirmBtn = document.getElementById('delete-modal-confirm');
  const deleteCancelBtn = document.getElementById('delete-modal-cancel');

  window.deleteCourseConfirm = function(index) {
    const course = currentCourses[index];
    if (!course) return;
    pendingDeleteIndex = index;
    deleteModalText.textContent = '确定要删除课程「' + course.name + '」吗？此操作不可撤销。';
    deleteModal.style.display = 'flex';
  };

  deleteCancelBtn.addEventListener('click', function() {
    deleteModal.style.display = 'none';
    pendingDeleteIndex = -1;
  });

  deleteModal.addEventListener('click', function(e) {
    if (e.target === deleteModal) {
      deleteModal.style.display = 'none';
      pendingDeleteIndex = -1;
    }
  });

  deleteConfirmBtn.addEventListener('click', async function() {
    deleteModal.style.display = 'none';
    const index = pendingDeleteIndex;
    pendingDeleteIndex = -1;
    if (index < 0) return;

    const course = currentCourses[index];
    if (!course) return;

    try {
      if (window.StarEarthDB) {
        await window.StarEarthDB.deleteCourse(course.id);
      } else {
        const courses = JSON.parse(localStorage.getItem('se-courses') || '[]');
        const filtered = courses.filter(c => c.id !== course.id);
        localStorage.setItem('se-courses', JSON.stringify(filtered));
      }
      // Also clean localStorage cache
      try {
        const local = JSON.parse(localStorage.getItem('se-courses') || '[]');
        localStorage.setItem('se-courses', JSON.stringify(local.filter(c => c.id !== course.id)));
      } catch(e) {}

      showToast('✅ 课程已删除', 'success');
      await render();
    } catch (err) {
      console.error('删除失败:', err);
      showToast('❌ 删除失败：' + err.message, 'error');
    }
  });

  // ---- Submit Review (upgraded to async) ----
  window.submitReview = async function(index) {
    const panel = document.querySelector(`.new-review[data-course-index="${index}"]`);
    const name = panel.querySelector('.review-name').value.trim();
    if (!name) {
      showToast('⚠️ 请填写评价人姓名', 'error');
      return;
    }

    const scores = {};
    let allScored = true;
    DIMS.forEach(dim => {
      const group = panel.querySelector(`[data-dim="${dim.key}"]`);
      const selected = group.querySelector('.score-btn[class*="selected-"]');
      if (selected) {
        scores[dim.key] = selected.dataset.grade;
      } else {
        allScored = false;
      }
    });

    if (!allScored) {
      showToast('⚠️ 请为所有 5 个维度打分', 'error');
      return;
    }

    const comment = panel.querySelector('.review-comment').value.trim();

    // Disable submit button
    const submitBtn = panel.querySelector('.btn-submit-review');
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';

    try {
      const courseId = currentCourses[index]?.id;
      await submitReviewData(courseId, {
        reviewer: name,
        scores: scores,
        comment: comment,
      }, index);

      showToast('✅ 评价已提交！', 'success');

      // Re-render to show updated reviews
      await render();

    } catch (err) {
      console.error('提交评审失败:', err);
      showToast('❌ 提交失败：' + err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = '提交评价';
    }
  };

  // ---- Score Badge ----
  function getScoreBadge(course) {
    if (!course.reviews || course.reviews.length === 0) {
      return '<span class="course-score-badge score-none">待评审</span>';
    }
    const avgScores = DIMS.map(dim => {
      const scores = course.reviews.map(r => GRADE_SCORE[r.scores[dim.key]] || 0);
      return scores.reduce((a, b) => a + b, 0) / scores.length;
    });
    const allB = avgScores.every(s => s >= 2);
    const topThreeA = avgScores.slice(0, 3).filter(s => s >= 2.5).length >= 2;
    const anyFail = avgScores.slice(0, 3).some(s => s < 1.5);

    if (anyFail) return '<span class="course-score-badge score-fail">不通过</span>';
    if (allB && topThreeA) return '<span class="course-score-badge score-pass">通过</span>';
    return '<span class="course-score-badge score-review">需修改</span>';
  }

  // ---- Utils ----
  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(msg, type) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast ' + type;
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // Initial render
  render();
})();
