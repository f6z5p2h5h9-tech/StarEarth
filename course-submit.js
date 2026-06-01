/* ===== Course Submit Logic ===== */
/* 已升级：通过 StarEarthDB 数据层提交课程，支持 Supabase 云端 + localStorage 降级 */
/* 支持编辑模式：通过 URL 参数 ?edit=courseId 进入编辑模式 */
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

  // ---- Connection Status Badge ----
  function showConnectionStatus() {
    const isCloud = window.StarEarthDB && window.StarEarthDB.isSupabaseReady();
    // Remove any existing badge first
    document.querySelector('.connection-badge')?.remove();
    const badge = document.createElement('div');
    badge.className = 'connection-badge ' + (isCloud ? 'cloud' : 'local');
    badge.innerHTML = isCloud
      ? '☁️ 云端同步已启用'
      : '💾 本地模式（数据仅存储在此设备）';
    const main = document.querySelector('.page-main');
    if (main) main.insertBefore(badge, main.firstChild.nextSibling?.nextSibling);
  }
  // Delay to allow Supabase CDN script to finish loading
  setTimeout(showConnectionStatus, 500);

  // ---- Edit Mode Detection ----
  const urlParams = new URLSearchParams(window.location.search);
  const editCourseId = urlParams.get('edit');
  let isEditMode = false;
  let editCourseData = null;

  if (editCourseId) {
    // Try to load from sessionStorage (passed from review page)
    try {
      const stored = sessionStorage.getItem('se-edit-course');
      if (stored) {
        editCourseData = JSON.parse(stored);
        if (editCourseData.id === editCourseId) {
          isEditMode = true;
        }
      }
    } catch (e) {
      console.warn('无法加载编辑数据:', e);
    }

    // Fallback: try localStorage
    if (!isEditMode) {
      const courses = JSON.parse(localStorage.getItem('se-courses') || '[]');
      const found = courses.find(c => c.id === editCourseId);
      if (found) {
        editCourseData = found;
        isEditMode = true;
      }
    }
  }

  // ---- Update Page UI for Edit Mode ----
  if (isEditMode) {
    // Change page title
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = '✏️ 编辑课程方案';

    const pageDesc = document.querySelector('.page-desc');
    if (pageDesc) pageDesc.innerHTML = `正在编辑：<strong>${escapeHtml(editCourseData.name)}</strong>。修改后点击底部「保存修改」按钮。`;

    // Change submit button text
    const btnSubmit = document.getElementById('btn-submit');
    if (btnSubmit) btnSubmit.textContent = '保存修改';

    const submitHint = document.querySelector('.submit-hint');
    if (submitHint) submitHint.textContent = '请完成所有必填项和全部自查后保存';

    // Add edit mode indicator
    const editBanner = document.createElement('div');
    editBanner.className = 'edit-mode-banner';
    editBanner.innerHTML = `
      <span>✏️ 编辑模式</span>
      <a href="course-review.html" class="edit-cancel-link">取消编辑，返回评审页</a>
    `;
    const main = document.querySelector('.page-main');
    if (main) main.insertBefore(editBanner, main.firstChild);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ---- Module Switching (PBL ↔ Sports) ----
  let isSportsMode = false;
  const moduleSelect = document.getElementById('f-module');
  const pblSections = document.getElementById('pbl-sections');
  const sportSections = document.getElementById('sport-sections');
  const sportBasicFields = document.getElementById('sport-basic-fields');

  function switchModuleMode() {
    isSportsMode = (moduleSelect.value === '玩耍与体育');
    pblSections.style.display = isSportsMode ? 'none' : '';
    sportSections.style.display = isSportsMode ? '' : 'none';
    sportBasicFields.style.display = isSportsMode ? '' : 'none';
    validateForm();
  }
  moduleSelect.addEventListener('change', switchModuleMode);

  // ---- Dual-track Toggle ----
  const dualToggle = document.getElementById('f-dual-track');
  const dualSection = document.getElementById('dual-track-section');
  const singleSection = document.getElementById('single-track-section');

  function updateTrackVisibility() {
    const isDual = dualToggle.checked;
    dualSection.style.display = isDual ? '' : 'none';
    singleSection.style.display = isDual ? 'none' : '';
  }

  dualToggle.addEventListener('change', () => {
    updateTrackVisibility();
    validateForm();
  });
  updateTrackVisibility();

  // ---- Timeline Editor ----
  const timelineEditor = document.getElementById('timeline-editor');
  const btnAddStep = document.getElementById('btn-add-step');
  let stepCount = 0;

  function addTimelineStep(data = {}) {
    stepCount++;
    const div = document.createElement('div');
    div.className = 'timeline-item';
    div.innerHTML = `
      <div>
        <label class="form-label" style="font-size:0.75rem">时长</label>
        <input type="text" class="form-input" placeholder="15分钟" value="${escapeHtml(data.duration || '')}" data-field="duration">
      </div>
      <div>
        <label class="form-label" style="font-size:0.75rem">活动内容与教师引导</label>
        <textarea class="form-textarea" placeholder="描述这个环节做什么，教师如何引导，关键提问/话术是什么" data-field="content">${escapeHtml(data.content || '')}</textarea>
      </div>
      <button type="button" class="timeline-remove" title="删除此环节">✕</button>
    `;
    div.querySelector('.timeline-remove').addEventListener('click', () => {
      div.remove();
    });
    timelineEditor.appendChild(div);
  }

  // ---- Material List Editor ----
  const materialList = document.getElementById('material-list');
  const btnAddMaterial = document.getElementById('btn-add-material');

  function addMaterialItem(data = {}) {
    const div = document.createElement('div');
    div.className = 'material-item';
    div.innerHTML = `
      <input type="text" class="form-input" placeholder="材料名称，如：纸板" value="${escapeHtml(data.name || '')}" data-field="mat-name">
      <input type="text" class="form-input" placeholder="数量规格，如：每组4张" value="${escapeHtml(data.qty || '')}" data-field="mat-qty">
      <button type="button" class="material-remove" title="删除此项">✕</button>
    `;
    div.querySelector('.material-remove').addEventListener('click', () => {
      div.remove();
      validateForm();
    });
    div.querySelectorAll('.form-input').forEach(inp => {
      inp.addEventListener('input', validateForm);
    });
    materialList.appendChild(div);
  }

  // ---- Sport Equipment Editor ----
  const equipList = document.getElementById('sport-equipment-list');
  const btnAddEquip = document.getElementById('btn-add-equipment');

  function addEquipmentItem(data = {}) {
    const div = document.createElement('div');
    div.className = 'equipment-item';
    div.innerHTML = `
      <input type="text" class="form-input" placeholder="器材名称，如：标志桶" value="${escapeHtml(data.name || '')}" data-field="eq-name">
      <input type="text" class="form-input eq-qty" placeholder="数量" value="${escapeHtml(data.qty || '')}" data-field="eq-qty">
      <button type="button" class="material-remove" title="删除">✕</button>
    `;
    div.querySelector('.material-remove').addEventListener('click', () => { div.remove(); validateForm(); });
    div.querySelectorAll('.form-input').forEach(inp => inp.addEventListener('input', validateForm));
    equipList.appendChild(div);
  }
  btnAddEquip.addEventListener('click', () => addEquipmentItem());

  // ---- Sport Phase Editor ----
  const sportFlowEditor = document.getElementById('sport-flow-editor');
  const btnAddPhase = document.getElementById('btn-add-sport-phase');
  let phaseCount = 0;

  function addSportPhase(data = {}) {
    phaseCount++;
    const n = phaseCount;
    const typeClass = data.phaseType ? 'phase-type-' + data.phaseType : '';
    const div = document.createElement('div');
    div.className = 'sport-phase-card ' + typeClass;
    div.innerHTML = `
      <div class="sport-phase-header">
        <span class="sport-phase-number">${n}</span>
        <select class="sport-phase-type-select" data-field="phaseType">
          <option value="warmup" ${data.phaseType==='warmup'?'selected':''}>🔥 热身</option>
          <option value="main" ${data.phaseType==='main'||!data.phaseType?'selected':''}>📘 主课</option>
          <option value="play" ${data.phaseType==='play'?'selected':''}>🎮 自由玩耍</option>
          <option value="cooldown" ${data.phaseType==='cooldown'?'selected':''}>💧 放松</option>
        </select>
        <input type="text" class="form-input" style="width:100px" placeholder="时长" value="${escapeHtml(data.phaseDuration || '')}" data-field="phaseDuration">
        <button type="button" class="sport-phase-remove" title="删除">✕</button>
      </div>
      <div class="sport-phase-fields">
        <div class="form-group">
          <label class="form-label" style="font-size:0.75rem">练习/游戏名称 *</label>
          <input type="text" class="form-input" placeholder="如：猫捉老鼠" value="${escapeHtml(data.gameName || '')}" data-field="gameName">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:0.75rem">组织形式 *</label>
          <input type="text" class="form-input" placeholder="如：两人一组轮换" value="${escapeHtml(data.formation || '')}" data-field="formation">
        </div>
        <div class="form-group full-width">
          <label class="form-label" style="font-size:0.75rem">指导要点</label>
          <textarea class="form-textarea" placeholder="教练关键提示、安全注意、动作要领" data-field="coaching">${escapeHtml(data.coaching || '')}</textarea>
        </div>
        <div class="form-group full-width">
          <label class="form-label" style="font-size:0.75rem">图示 / 场地布局</label>
          <textarea class="form-textarea" placeholder="用文字描述场地布局、跑动路线，如：\n⬜ ⬜ ⬜（标志桶间距3米）\n↗ 学生从起点绕桶S形跑" data-field="diagram">${escapeHtml(data.diagram || '')}</textarea>
        </div>
      </div>
    `;
    div.querySelector('.sport-phase-remove').addEventListener('click', () => { div.remove(); renumberPhases(); validateForm(); });
    div.querySelector('.sport-phase-type-select').addEventListener('change', function() {
      div.className = 'sport-phase-card phase-type-' + this.value;
    });
    div.querySelectorAll('.form-input, .form-textarea').forEach(inp => inp.addEventListener('input', validateForm));
    sportFlowEditor.appendChild(div);
  }

  function renumberPhases() {
    sportFlowEditor.querySelectorAll('.sport-phase-number').forEach((el, i) => {
      el.textContent = i + 1;
    });
    phaseCount = sportFlowEditor.querySelectorAll('.sport-phase-card').length;
  }

  btnAddPhase.addEventListener('click', () => addSportPhase());

  // ---- Pre-fill Form in Edit Mode ----
  if (isEditMode && editCourseData) {
    prefillForm(editCourseData);
  } else {
    // Add 3 default steps for new PBL courses
    addTimelineStep({ duration: '10分钟', content: '' });
    addTimelineStep({ duration: '30分钟', content: '' });
    addTimelineStep({ duration: '10分钟', content: '' });
    addMaterialItem();
    // Add 4 default phases for new sport courses
    addSportPhase({ phaseType: 'warmup', phaseDuration: '10分钟', gameName: '', formation: '', coaching: '', diagram: '' });
    addSportPhase({ phaseType: 'main', phaseDuration: '25分钟', gameName: '', formation: '', coaching: '', diagram: '' });
    addSportPhase({ phaseType: 'play', phaseDuration: '15分钟', gameName: '', formation: '', coaching: '', diagram: '' });
    addSportPhase({ phaseType: 'cooldown', phaseDuration: '5分钟', gameName: '', formation: '', coaching: '', diagram: '' });
    addEquipmentItem();
  }

  function prefillForm(course) {
    // Basic info
    setVal('f-name', course.name);
    setVal('f-module', course.module);
    setVal('f-age', course.age);
    setVal('f-type', course.type);
    setVal('f-duration', course.duration);
    setVal('f-teacher', course.teacher);

    // Goals
    setVal('f-ability', course.ability);
    setVal('f-alignment', course.alignment);
    setVal('f-diff', course.diff);

    // PBL Design
    setVal('f-driving', course.driving);

    // Dual track toggle
    dualToggle.checked = !!course.dualTrack;
    updateTrackVisibility();

    if (course.dualTrack) {
      setVal('f-steam-knowledge', course.steamKnowledge);
      setVal('f-steam-handson', course.steamHandson);
      setVal('f-steam-solution', course.steamSolution);
      setVal('f-hum-inquiry', course.humInquiry);
      setVal('f-hum-discussion', course.humDiscussion);
      setVal('f-hum-resource', course.humResource);
      setVal('f-convergence', course.convergence);
    } else {
      setVal('f-knowledge', course.knowledge);
      setVal('f-solution', course.solution);
      setVal('f-handson', course.handson);
    }

    setVal('f-reflect', course.reflect);

    // Steps
    if (course.steps && course.steps.length > 0) {
      course.steps.forEach(step => addTimelineStep(step));
    } else {
      addTimelineStep({ duration: '10分钟', content: '' });
      addTimelineStep({ duration: '30分钟', content: '' });
      addTimelineStep({ duration: '10分钟', content: '' });
    }

    // Materials
    if (Array.isArray(course.materials) && course.materials.length > 0) {
      course.materials.forEach(mat => addMaterialItem(mat));
    } else {
      addMaterialItem();
    }

    // Safety
    setVal('f-safety', course.safety);

    // ---- Sports Course prefill ----
    if (course.isSportsCourse) {
      setVal('f-sport-students', course.sportStudents);
      setVal('f-sport-date', course.sportDate);
      setVal('f-sport-venue', course.sportVenue);
      setVal('f-sport-theme', course.sportTheme);
      setVal('f-sport-goals', course.sportGoals);
      setVal('f-sport-transfer', course.sportTransfer);
      setVal('f-sport-safety', course.sportSafety);
      setVal('f-sport-diff', course.sportDiff);
      // Equipment
      if (Array.isArray(course.sportEquipment) && course.sportEquipment.length > 0) {
        course.sportEquipment.forEach(eq => addEquipmentItem(eq));
      } else {
        addEquipmentItem();
      }
      // Phases
      if (Array.isArray(course.sportPhases) && course.sportPhases.length > 0) {
        course.sportPhases.forEach(ph => addSportPhase(ph));
      }
    }

    // Trigger module switch and validation after a tick
    switchModuleMode();
    setTimeout(validateForm, 100);
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el && value) {
      el.value = value;
    }
  }

  btnAddStep.addEventListener('click', () => addTimelineStep());
  btnAddMaterial.addEventListener('click', () => addMaterialItem());

  // ---- Self-check Progress ----
  const scFill = document.getElementById('sc-fill');
  const scCount = document.getElementById('sc-count');
  const scFillSport = document.getElementById('sc-fill-sport');
  const scCountSport = document.getElementById('sc-count-sport');
  const btnSubmit = document.getElementById('btn-submit');

  function updateSelfcheck() {
    // PBL self-check
    const scChecks = document.querySelectorAll('.sc-check');
    const totalChecks = scChecks.length;
    const checked = document.querySelectorAll('.sc-check:checked').length;
    const pct = totalChecks > 0 ? (checked / totalChecks) * 100 : 0;
    if (scFill) scFill.style.width = pct + '%';
    if (scCount) scCount.textContent = `${checked} / ${totalChecks} 项已确认`;
    // Sport self-check
    const sportChecks = document.querySelectorAll('.sc-check-sport');
    const totalSport = sportChecks.length;
    const checkedSport = document.querySelectorAll('.sc-check-sport:checked').length;
    const pctSport = totalSport > 0 ? (checkedSport / totalSport) * 100 : 0;
    if (scFillSport) scFillSport.style.width = pctSport + '%';
    if (scCountSport) scCountSport.textContent = `${checkedSport} / ${totalSport} 项已确认`;
    validateForm();
  }

  document.addEventListener('change', function(e) {
    if (e.target.classList.contains('sc-check') || e.target.classList.contains('sc-check-sport')) updateSelfcheck();
  });

  // ---- Form Validation ----
  const basicRequired = ['f-name', 'f-module', 'f-age', 'f-type', 'f-duration', 'f-teacher'];
  const pblShared = ['f-ability', 'f-alignment', 'f-diff', 'f-driving', 'f-reflect'];
  const dualRequired = ['f-steam-knowledge', 'f-steam-handson', 'f-hum-inquiry', 'f-hum-discussion', 'f-convergence'];
  const singleRequired = ['f-knowledge', 'f-handson'];
  const sportRequired = ['f-sport-students', 'f-sport-venue', 'f-sport-theme', 'f-sport-goals', 'f-sport-safety'];

  function validateForm() {
    let activeRequired;
    let allSelfCheckDone;

    if (isSportsMode) {
      activeRequired = [...basicRequired, ...sportRequired];
      // Sport: check equipment
      const eqItems = equipList.querySelectorAll('.equipment-item');
      const hasEquip = Array.from(eqItems).some(item => {
        const n = item.querySelector('[data-field="eq-name"]');
        return n && n.value.trim() !== '';
      });
      // Sport: check at least one phase
      const hasPhases = sportFlowEditor.querySelectorAll('.sport-phase-card').length > 0;
      const sportChecks = document.querySelectorAll('.sc-check-sport');
      allSelfCheckDone = document.querySelectorAll('.sc-check-sport:checked').length === sportChecks.length;
      const allFieldsFilled = activeRequired.every(id => {
        const el = document.getElementById(id);
        return el && el.value.trim() !== '';
      });
      btnSubmit.disabled = !(allFieldsFilled && hasEquip && hasPhases && allSelfCheckDone);
    } else {
      const isDual = dualToggle.checked;
      activeRequired = isDual
        ? [...basicRequired, ...pblShared, ...dualRequired]
        : [...basicRequired, ...pblShared, ...singleRequired];
      const allFieldsFilled = activeRequired.every(id => {
        const el = document.getElementById(id);
        return el && el.value.trim() !== '';
      });
      const materialItems = materialList.querySelectorAll('.material-item');
      const hasMaterials = Array.from(materialItems).some(item =>
        item.querySelector('[data-field="mat-name"]').value.trim() !== ''
      );
      const scChecks = document.querySelectorAll('.sc-check');
      allSelfCheckDone = document.querySelectorAll('.sc-check:checked').length === scChecks.length;
      btnSubmit.disabled = !(allFieldsFilled && hasMaterials && allSelfCheckDone);
    }
  }

  // Listen to all form inputs
  document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => {
    el.addEventListener('input', validateForm);
  });

  // ---- Form Submit (supports both create and update) ----
  document.getElementById('course-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Disable submit button to prevent double submission
    btnSubmit.disabled = true;
    btnSubmit.textContent = isEditMode ? '保存中...' : '提交中...';

    const isDual = dualToggle.checked;

    // Collect timeline steps
    const steps = [];
    timelineEditor.querySelectorAll('.timeline-item').forEach(item => {
      const dur = item.querySelector('[data-field="duration"]').value.trim();
      const content = item.querySelector('[data-field="content"]').value.trim();
      if (dur || content) steps.push({ duration: dur, content: content });
    });

    let courseData;

    if (isSportsMode) {
      courseData = {
        name: val('f-name'),
        module: val('f-module'),
        age: val('f-age'),
        type: val('f-type'),
        duration: val('f-duration'),
        teacher: val('f-teacher'),
        isSportsCourse: true,
        sportStudents: val('f-sport-students'),
        sportDate: val('f-sport-date'),
        sportVenue: val('f-sport-venue'),
        sportEquipment: collectEquipment(),
        sportTheme: val('f-sport-theme'),
        sportGoals: val('f-sport-goals'),
        sportTransfer: val('f-sport-transfer'),
        sportPhases: collectSportPhases(),
        sportSafety: val('f-sport-safety'),
        sportDiff: val('f-sport-diff'),
        // empty PBL fields for compatibility
        ability: '', alignment: '', diff: '', driving: '', dualTrack: false,
        reflect: '', steps: [], materials: [], safety: val('f-sport-safety'),
      };
    } else {
      courseData = {
        name: val('f-name'),
        module: val('f-module'),
        age: val('f-age'),
        type: val('f-type'),
        duration: val('f-duration'),
        teacher: val('f-teacher'),
        isSportsCourse: false,
        ability: val('f-ability'),
        alignment: val('f-alignment'),
        diff: val('f-diff'),
        driving: val('f-driving'),
        dualTrack: isDual,
        steamKnowledge: isDual ? val('f-steam-knowledge') : '',
        steamHandson: isDual ? val('f-steam-handson') : '',
        steamSolution: isDual ? val('f-steam-solution') : '',
        humInquiry: isDual ? val('f-hum-inquiry') : '',
        humDiscussion: isDual ? val('f-hum-discussion') : '',
        humResource: isDual ? val('f-hum-resource') : '',
        convergence: isDual ? val('f-convergence') : '',
        knowledge: isDual ? '' : val('f-knowledge'),
        solution: isDual ? '' : val('f-solution'),
        handson: isDual ? '' : val('f-handson'),
        reflect: val('f-reflect'),
        steps: steps,
        materials: collectMaterials(),
        safety: val('f-safety'),
      };
    }

    try {
      if (isEditMode) {
        // ---- UPDATE existing course ----
        if (window.StarEarthDB) {
          await window.StarEarthDB.updateCourse(editCourseId, courseData);
        } else {
          // Direct localStorage update
          const courses = JSON.parse(localStorage.getItem('se-courses') || '[]');
          const idx = courses.findIndex(c => c.id === editCourseId);
          if (idx !== -1) {
            courses[idx] = {
              ...courses[idx],
              ...courseData,
              id: editCourseId,
              submittedAt: courses[idx].submittedAt,
              reviews: courses[idx].reviews || [],
            };
            localStorage.setItem('se-courses', JSON.stringify(courses));
          }
        }
        // Clear edit data from sessionStorage
        sessionStorage.removeItem('se-edit-course');

        showToast('✅ 课程方案已更新！即将返回评审页...', 'success');
      } else {
        // ---- CREATE new course ----
        if (window.StarEarthDB) {
          await window.StarEarthDB.createCourse(courseData);
        } else {
          const course = {
            id: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            ...courseData,
            submittedAt: new Date().toISOString(),
            reviews: []
          };
          const courses = JSON.parse(localStorage.getItem('se-courses') || '[]');
          courses.push(course);
          localStorage.setItem('se-courses', JSON.stringify(courses));
        }

        const isCloud = window.StarEarthDB && window.StarEarthDB.isSupabaseReady();
        showToast(isCloud
          ? '✅ 课程方案已提交到云端！即将跳转到评审页面...'
          : '✅ 课程方案已保存！即将跳转到评审页面...', 'success');
      }

      setTimeout(() => {
        window.location.href = 'course-review.html';
      }, 1500);

    } catch (err) {
      console.error(isEditMode ? '更新课程失败:' : '提交课程失败:', err);
      showToast('❌ ' + (isEditMode ? '更新' : '提交') + '失败：' + err.message, 'error');
      btnSubmit.disabled = false;
      btnSubmit.textContent = isEditMode ? '保存修改' : '提交课程方案';
    }
  });

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function collectMaterials() {
    const items = [];
    materialList.querySelectorAll('.material-item').forEach(item => {
      const name = item.querySelector('[data-field="mat-name"]').value.trim();
      const qty = item.querySelector('[data-field="mat-qty"]').value.trim();
      if (name) items.push({ name, qty });
    });
    return items;
  }

  function collectEquipment() {
    const items = [];
    equipList.querySelectorAll('.equipment-item').forEach(item => {
      const name = item.querySelector('[data-field="eq-name"]').value.trim();
      const qty = item.querySelector('[data-field="eq-qty"]').value.trim();
      if (name) items.push({ name, qty });
    });
    return items;
  }

  function collectSportPhases() {
    const phases = [];
    sportFlowEditor.querySelectorAll('.sport-phase-card').forEach(card => {
      phases.push({
        phaseType: card.querySelector('[data-field="phaseType"]').value,
        phaseDuration: card.querySelector('[data-field="phaseDuration"]').value.trim(),
        gameName: card.querySelector('[data-field="gameName"]').value.trim(),
        formation: card.querySelector('[data-field="formation"]').value.trim(),
        coaching: card.querySelector('[data-field="coaching"]').value.trim(),
        diagram: card.querySelector('[data-field="diagram"]').value.trim(),
      });
    });
    return phases;
  }

  // ---- Toast ----
  function showToast(msg, type) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast ' + type;
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => toast.classList.remove('show'), 3000);
  }
})();
