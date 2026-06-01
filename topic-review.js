/* ===== Topic Review Logic ===== */
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

  // ---- Tab Switching ----
  const tabBtns = document.querySelectorAll('.topic-tab');
  const panels = document.querySelectorAll('.topic-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'list') renderTopicList();
    });
  });

  // ---- Self-check Progress ----
  const scFill = document.getElementById('sc-fill');
  const scCount = document.getElementById('sc-count');
  const btnSubmit = document.getElementById('btn-submit');
  const TOTAL_CHECKS = 8;

  function updateSelfcheck() {
    const checked = document.querySelectorAll('.sc-check:checked').length;
    const pct = (checked / TOTAL_CHECKS) * 100;
    scFill.style.width = pct + '%';
    scCount.textContent = `${checked} / ${TOTAL_CHECKS} 项已确认`;
    validateForm();
  }

  document.addEventListener('change', function(e) {
    if (e.target.classList.contains('sc-check')) updateSelfcheck();
  });

  // ---- Form Validation ----
  const requiredFields = ['t-title', 't-teacher', 't-age', 't-type', 't-driving', 't-inspiration', 't-diff'];

  function validateForm() {
    const allFieldsFilled = requiredFields.every(id => {
      const el = document.getElementById(id);
      return el && el.value.trim() !== '';
    });

    // At least 1 module checked
    const moduleChecked = document.querySelectorAll('#t-modules input:checked').length > 0;

    // At least 2 abilities checked
    const abilityChecked = document.querySelectorAll('#t-abilities input:checked').length >= 2;

    btnSubmit.disabled = !(allFieldsFilled && moduleChecked && abilityChecked);
  }

  // Listen to all form inputs
  document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => {
    el.addEventListener('input', validateForm);
  });
  document.querySelectorAll('#t-modules input, #t-abilities input').forEach(el => {
    el.addEventListener('change', validateForm);
  });

  // ---- Form Submit ----
  document.getElementById('topic-form').addEventListener('submit', function(e) {
    e.preventDefault();

    // Collect modules
    const modules = [];
    document.querySelectorAll('#t-modules input:checked').forEach(cb => modules.push(cb.value));

    // Collect abilities
    const abilities = [];
    document.querySelectorAll('#t-abilities input:checked').forEach(cb => abilities.push(cb.value));

    // Collect self-checks
    const selfChecks = {};
    let passCount = 0;
    document.querySelectorAll('.sc-check').forEach(cb => {
      selfChecks[cb.dataset.key] = cb.checked;
      if (cb.checked) passCount++;
    });

    const topic = {
      id: 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: val('t-title'),
      teacher: val('t-teacher'),
      age: val('t-age'),
      type: val('t-type'),
      modules: modules,
      driving: val('t-driving'),
      inspiration: val('t-inspiration'),
      abilities: abilities,
      diff: val('t-diff'),
      selfChecks: selfChecks,
      selfCheckPass: passCount,
      selfCheckTotal: TOTAL_CHECKS,
      reviews: [],
      submittedAt: new Date().toISOString()
    };

    // Check if editing
    const form = document.getElementById('topic-form');
    const editIndex = form.dataset.editIndex;
    const topics = getTopics();

    if (editIndex !== undefined && editIndex !== '') {
      const idx = parseInt(editIndex);
      if (idx >= 0 && idx < topics.length) {
        // Preserve id, reviews, submittedAt from original
        topic.id = topics[idx].id;
        topic.reviews = topics[idx].reviews || [];
        topic.submittedAt = topics[idx].submittedAt;
        topics[idx] = topic;
        showToast('✅ 选题已更新！', 'success');
      }
    } else {
      topics.push(topic);
      showToast('✅ 选题已提交！切换到「已提交选题」查看', 'success');
    }

    saveTopics(topics);

    // Reset form and edit state
    form.reset();
    delete form.dataset.editIndex;
    btnSubmit.textContent = '提交选题';
    updateSelfcheck();
    validateForm();
    updateCount();

    // Switch to list tab
    setTimeout(() => {
      document.getElementById('tab-btn-list').click();
    }, 800);
  });

  // ---- Data Access ----
  function getTopics() {
    return JSON.parse(localStorage.getItem('se-topics') || '[]');
  }
  function saveTopics(topics) {
    localStorage.setItem('se-topics', JSON.stringify(topics));
    if (window.StarEarthDB && window.StarEarthDB.isSupabaseReady()) {
      window.StarEarthDB.saveTopics(topics).catch(e => console.warn('Cloud topic sync failed:', e));
    }
  }
  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  // ---- Topic Count Badge ----
  function updateCount() {
    const count = getTopics().length;
    document.getElementById('topic-count').textContent = count;
  }
  updateCount();

  // ---- Cloud Init ----
  (async function initCloudTopics() {
    if (window.StarEarthDB && window.StarEarthDB.isSupabaseReady()) {
      try {
        const cloudTopics = await window.StarEarthDB.getTopics();
        if (cloudTopics && cloudTopics.length > 0) {
          const localTopics = getTopics();
          const cloudIds = new Set(cloudTopics.map(t => t.id));
          const localOnly = localTopics.filter(t => !cloudIds.has(t.id));
          const merged = [...cloudTopics, ...localOnly];
          localStorage.setItem('se-topics', JSON.stringify(merged));
          if (localOnly.length > 0) {
            for (const t of localOnly) {
              await window.StarEarthDB.saveTopic(t).catch(() => {});
            }
          }
        } else if (getTopics().length > 0) {
          await window.StarEarthDB.saveTopics(getTopics()).catch(() => {});
        }
        updateCount();
        renderTopicList();
      } catch (e) { console.warn('Cloud topics init failed:', e); }
    }
  })();

  // ---- Peer Review Dimensions ----
  const REVIEW_DIMS = [
    { key: 'r1', label: '选题价值与真实性', desc: '选题是否来自真实世界、具有教育意义' },
    { key: 'r2', label: '教育目标契合度', desc: '是否对齐星与土的关键能力和教育理念' },
    { key: 'r3', label: 'PBL 可行性', desc: '能否设计为项目式学习课程' },
    { key: 'r4', label: '年龄适配度', desc: '是否适合目标年龄段学生' },
  ];

  // ---- Render Topic List ----
  function renderTopicList() {
    const topics = getTopics();
    const listEl = document.getElementById('topic-list');

    if (topics.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h3>还没有提交的选题</h3>
          <p>切换到「提交选题」标签，提交你的课题构思。</p>
        </div>`;
      return;
    }

    listEl.innerHTML = topics.map((t, i) => renderTopicCard(t, i)).join('');
  }

  function renderTopicCard(topic, index) {
    // Defensive defaults for cloud-synced data
    topic.modules = topic.modules || (topic.module ? [topic.module] : []);
    topic.abilities = topic.abilities || [];
    topic.selfChecks = topic.selfChecks || {};
    topic.selfCheckPass = topic.selfCheckPass || 0;
    topic.selfCheckTotal = topic.selfCheckTotal || 8;
    topic.driving = topic.driving || topic.eq || '';
    topic.inspiration = topic.inspiration || '';
    topic.diff = topic.diff || '';
    topic.reviews = topic.reviews || [];

    const date = new Date(topic.submittedAt).toLocaleDateString('zh-CN');
    const conclusion = getConclusion(topic);

    return `
    <div class="course-card" data-index="${index}" id="topic-${index}">
      <div class="course-card-header" onclick="window.__toggleTopic(${index})">
        <div class="course-meta">
          <span class="course-name">${esc(topic.title)}</span>
          <div class="course-tags">
            ${topic.modules.map(m => `<span class="course-tag tag-module">${esc(m)}</span>`).join('')}
            <span class="course-tag tag-age">${esc(topic.age)}</span>
            <span class="course-tag tag-type">${esc(topic.type)}</span>
          </div>
        </div>
        <span class="course-score-badge ${conclusion.badgeClass}">${conclusion.label}</span>
        <svg class="course-expand-icon" viewBox="0 0 24 24" width="20" height="20"><polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2"/></svg>
      </div>
      <div class="course-card-body">
        <div class="course-detail">
          <!-- Meta -->
          <div class="detail-grid">
            <div class="detail-section">
              <div class="detail-label">提交教师</div>
              <div class="detail-text">${esc(topic.teacher)}</div>
            </div>
            <div class="detail-section">
              <div class="detail-label">提交日期 / 类型</div>
              <div class="detail-text">${date} · ${esc(topic.type)}</div>
            </div>
          </div>

          <!-- Driving Question -->
          <div class="detail-section">
            <div class="detail-label">核心驱动问题</div>
            <div class="detail-text" style="font-weight:500;color:var(--accent-star);font-size:1rem">${esc(topic.driving)}</div>
          </div>

          <!-- Inspiration -->
          <div class="detail-section">
            <div class="detail-label">选题来源 / 灵感</div>
            <div class="detail-text">${esc(topic.inspiration)}</div>
          </div>

          <!-- Abilities -->
          <div class="detail-section">
            <div class="detail-label">预期培养能力</div>
            <div class="detail-text">
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
                ${topic.abilities.map(a => `<span style="font-size:0.8rem;padding:3px 10px;border-radius:20px;background:rgba(78,205,196,0.1);color:var(--accent-earth)">${esc(a)}</span>`).join('')}
              </div>
            </div>
          </div>

          <!-- Diff -->
          <div class="detail-section">
            <div class="detail-label">与学校教育的差异化</div>
            <div class="detail-text">${esc(topic.diff)}</div>
          </div>

          <!-- Self-check result -->
          <div class="detail-section">
            <div class="detail-label">自检结果</div>
            <div class="topic-selfcheck-result">
              <div class="selfcheck-mini-bar">
                <div class="selfcheck-mini-fill" style="width:${(topic.selfCheckPass / topic.selfCheckTotal * 100)}%"></div>
              </div>
              <span class="selfcheck-mini-text">${topic.selfCheckPass} / ${topic.selfCheckTotal} 项通过</span>
            </div>
            <div class="selfcheck-detail-list">
              ${renderSelfCheckDetail(topic.selfChecks)}
            </div>
          </div>
        </div>

        <!-- Peer Review Panel -->
        <div class="review-panel">
          <div class="review-panel-title">👥 互评打分</div>

          <!-- Review Summary -->
          ${renderTopicReviewSummary(topic)}

          <!-- Existing Reviews -->
          ${renderTopicReviewHistory(topic)}

          <!-- New Review Form -->
          ${renderTopicReviewForm(index)}
        </div>

        <!-- Actions -->
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;padding-top:14px;border-top:1px solid var(--border,#333)">
          <button type="button" onclick="window.__editTopic(${index})" style="padding:7px 18px;border-radius:8px;border:1px solid var(--border,#444);background:none;color:var(--accent-earth,#4ecdc4);cursor:pointer;font-size:0.82rem;transition:all .2s">✏️ 编辑</button>
          <button type="button" onclick="window.__deleteTopic(${index})" style="padding:7px 18px;border-radius:8px;border:1px solid rgba(239,68,68,0.3);background:none;color:#ef4444;cursor:pointer;font-size:0.82rem;transition:all .2s">🗑️ 删除</button>
        </div>
      </div>
    </div>`;
  }

  function renderSelfCheckDetail(checks) {
    const labels = {
      q1: '链接真实世界',
      q2: '驱动问题开放',
      q3: '允许动手探索',
      q4: '与学校课程差异',
      q5: '对齐教育目标',
      q6: '年龄适配',
      q7: '走出舒适区',
      q8: '支持协作展示'
    };
    return Object.keys(labels).map(key => {
      const passed = checks[key];
      return `<span class="sc-detail-chip ${passed ? 'sc-pass' : 'sc-fail'}">${passed ? '✓' : '✗'} ${labels[key]}</span>`;
    }).join('');
  }

  function renderTopicReviewSummary(topic) {
    if (!topic.reviews || topic.reviews.length === 0) return '';

    const GRADE_SCORE = { A: 3, B: 2, C: 1 };
    const avgScores = REVIEW_DIMS.map(dim => {
      const scores = topic.reviews.map(r => GRADE_SCORE[r.scores[dim.key]] || 0);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return { dim, avg };
    });

    const totalAvg = avgScores.reduce((s, { avg }) => s + avg, 0) / REVIEW_DIMS.length;
    const conclusion = getConclusion(topic);

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
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;text-align:center">${topic.reviews.length}人互评</div>
        <div class="summary-result ${conclusion.badgeClass}">${conclusion.label}</div>
      </div>
    </div>`;
  }

  function renderTopicReviewHistory(topic) {
    if (!topic.reviews || topic.reviews.length === 0) {
      return '<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:20px">暂无互评记录，请在下方提交评价。</p>';
    }
    return `<div class="review-history">
      ${topic.reviews.map(r => {
        const date = new Date(r.date).toLocaleDateString('zh-CN');
        return `<div class="review-entry">
          <div class="review-entry-header">
            <span class="reviewer-name">👤 ${esc(r.reviewer)}</span>
            <span class="review-date">${date}</span>
          </div>
          <div class="review-scores">
            ${REVIEW_DIMS.map(dim => {
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

  function renderTopicReviewForm(index) {
    return `<div class="new-review" data-topic-index="${index}">
      <h4>➕ 提交互评</h4>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">评价人姓名 <span class="required">*</span></label>
        <input type="text" class="form-input review-name" placeholder="填写你的姓名" style="max-width:280px">
      </div>
      <div class="score-dimensions">
        ${REVIEW_DIMS.map(dim => `
          <div class="score-dim-row">
            <span class="score-dim-label">${dim.label}<br><span class="dim-weight" style="font-size:0.7rem;color:var(--text-muted)">${dim.desc}</span></span>
            <div class="score-btn-group" data-dim="${dim.key}">
              <button type="button" class="score-btn" data-grade="A" onclick="window.__selectGrade(this)">推荐 A</button>
              <button type="button" class="score-btn" data-grade="B" onclick="window.__selectGrade(this)">一般 B</button>
              <button type="button" class="score-btn" data-grade="C" onclick="window.__selectGrade(this)">不推荐 C</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">评语建议（可选）</label>
        <textarea class="form-textarea review-comment" placeholder="对这个选题的建议和想法..." style="min-height:70px"></textarea>
      </div>
      <button type="button" class="btn-submit-review" onclick="window.__submitTopicReview(${index})">提交互评</button>
    </div>`;
  }

  // ---- Conclusion Logic ----
  function getConclusion(topic) {
    const GRADE_SCORE = { A: 3, B: 2, C: 1 };
    const selfRate = topic.selfCheckPass / topic.selfCheckTotal;

    // If no peer reviews yet, base only on self-check
    if (!topic.reviews || topic.reviews.length === 0) {
      if (selfRate >= 1) return { label: '待互评', badgeClass: 'score-none' };
      if (selfRate >= 0.75) return { label: '待互评', badgeClass: 'score-none' };
      return { label: '自检未通过', badgeClass: 'score-fail' };
    }

    // With peer reviews: calculate avg score
    const avgScores = REVIEW_DIMS.map(dim => {
      const scores = topic.reviews.map(r => GRADE_SCORE[r.scores[dim.key]] || 0);
      return scores.reduce((a, b) => a + b, 0) / scores.length;
    });

    const totalAvg = avgScores.reduce((s, v) => s + v, 0) / REVIEW_DIMS.length;
    const anyFail = avgScores.some(s => s < 1.5);

    // Combined: self-check weight 30% + peer review weight 70%
    const combinedScore = selfRate * 0.3 + (totalAvg / 3) * 0.7;

    if (anyFail || combinedScore < 0.5) {
      return { label: '不建议立项', badgeClass: 'score-fail' };
    }
    if (combinedScore >= 0.8 && selfRate >= 0.875) {
      return { label: '建议立项', badgeClass: 'score-pass' };
    }
    return { label: '建议修改', badgeClass: 'score-review' };
  }

  // ---- Global handlers ----
  window.__toggleTopic = function(index) {
    const card = document.getElementById('topic-' + index);
    card.classList.toggle('expanded');
  };

  window.__deleteTopic = function(index) {
    const topics = getTopics();
    if (index < 0 || index >= topics.length) return;
    const title = topics[index].title;
    if (!confirm(`确定要删除选题「${title}」吗？\n此操作不可撤销。`)) return;
    const topicId = topics[index].id;
    topics.splice(index, 1);
    saveTopics(topics);
    // Also delete from cloud
    if (window.StarEarthDB && window.StarEarthDB.isSupabaseReady() && topicId) {
      window.StarEarthDB.deleteTopic(topicId).catch(() => {});
    }
    showToast('🗑️ 选题已删除', 'success');
    updateCount();
    renderTopicList();
  };

  window.__editTopic = function(index) {
    const topics = getTopics();
    if (index < 0 || index >= topics.length) return;
    const t = topics[index];

    // Switch to submit tab
    document.querySelectorAll('.topic-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.topic-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('.topic-tab[data-tab="submit"]').classList.add('active');
    document.getElementById('panel-submit').classList.add('active');

    // Fill form
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('t-title', t.title);
    set('t-teacher', t.teacher);
    set('t-age', t.age);
    set('t-type', t.type);
    set('t-driving', t.driving);
    set('t-inspiration', t.inspiration);
    set('t-diff', t.diff);

    // Check modules
    document.querySelectorAll('#t-modules input').forEach(cb => {
      cb.checked = t.modules && t.modules.includes(cb.value);
    });

    // Check abilities
    document.querySelectorAll('#t-abilities input').forEach(cb => {
      cb.checked = t.abilities && t.abilities.includes(cb.value);
    });

    // Check self-checks
    if (t.selfChecks) {
      document.querySelectorAll('.sc-check').forEach(cb => {
        cb.checked = !!t.selfChecks[cb.dataset.key];
      });
    }

    // Update self-check UI
    const checked = document.querySelectorAll('.sc-check:checked').length;
    const pct = (checked / TOTAL_CHECKS) * 100;
    scFill.style.width = pct + '%';
    scCount.textContent = `${checked} / ${TOTAL_CHECKS} 项已确认`;

    // Mark as editing (store index)
    document.getElementById('topic-form').dataset.editIndex = index;
    btnSubmit.textContent = '💾 保存修改';
    validateForm();

    showToast('📝 正在编辑选题，修改后点击「保存修改」', 'success');
  };

  window.__selectGrade = function(btn) {
    const group = btn.parentElement;
    group.querySelectorAll('.score-btn').forEach(b => b.className = 'score-btn');
    const grade = btn.dataset.grade;
    btn.classList.add('selected-' + grade.toLowerCase());
  };

  window.__submitTopicReview = function(index) {
    const panel = document.querySelector(`.new-review[data-topic-index="${index}"]`);
    const name = panel.querySelector('.review-name').value.trim();
    if (!name) {
      showToast('⚠️ 请填写评价人姓名', 'error');
      return;
    }

    const scores = {};
    let allScored = true;
    REVIEW_DIMS.forEach(dim => {
      const group = panel.querySelector(`[data-dim="${dim.key}"]`);
      const selected = group.querySelector('.score-btn[class*="selected-"]');
      if (selected) {
        scores[dim.key] = selected.dataset.grade;
      } else {
        allScored = false;
      }
    });

    if (!allScored) {
      showToast('⚠️ 请为所有 4 个维度打分', 'error');
      return;
    }

    const comment = panel.querySelector('.review-comment').value.trim();

    const topics = getTopics();
    if (!topics[index].reviews) topics[index].reviews = [];
    topics[index].reviews.push({
      reviewer: name,
      scores: scores,
      comment: comment,
      date: new Date().toISOString()
    });
    saveTopics(topics);

    showToast('✅ 互评已提交！', 'success');
    renderTopicList();
  };

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
})();
