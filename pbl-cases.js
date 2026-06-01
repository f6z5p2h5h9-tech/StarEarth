/* ===== PBL Cases Logic ===== */
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
  document.querySelectorAll('.topic-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.topic-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.topic-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'list') renderCaseList();
    });
  });

  // ---- IndexedDB File Storage ----
  // Files too large for localStorage (~5MB limit) are stored in IndexedDB
  const FileStore = {
    dbName: 'StarEarthFiles',
    storeName: 'files',
    db: null,
    open() {
      return new Promise((resolve, reject) => {
        if (this.db) return resolve(this.db);
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = (e) => {
          e.target.result.createObjectStore(this.storeName);
        };
        req.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        req.onerror = (e) => reject(e.target.error);
      });
    },
    async save(key, dataUrl) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).put(dataUrl, key);
        tx.oncomplete = resolve;
        tx.onerror = (e) => reject(e.target.error);
      });
    },
    async get(key) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const req = tx.objectStore(this.storeName).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = (e) => reject(e.target.error);
      });
    },
    async delete(key) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).delete(key);
        tx.oncomplete = resolve;
        tx.onerror = (e) => reject(e.target.error);
      });
    }
  };

  // ---- Data ----
  // Sync: getCases reads from localStorage cache; cloud data is loaded async on init
  function getCases() { return JSON.parse(localStorage.getItem('se-pbl-cases') || '[]'); }
  function saveCases(c) {
    localStorage.setItem('se-pbl-cases', JSON.stringify(c));
    // Async cloud sync
    if (window.StarEarthDB && window.StarEarthDB.isSupabaseReady()) {
      window.StarEarthDB.saveCases(c).catch(e => console.warn('Cloud sync failed:', e));
    }
  }
  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function updateCount() { document.getElementById('case-count').textContent = getCases().length; }

  // Load from cloud on init
  (async function initCloudCases() {
    if (window.StarEarthDB && window.StarEarthDB.isSupabaseReady()) {
      try {
        const cloudCases = await window.StarEarthDB.getCases();
        if (cloudCases && cloudCases.length > 0) {
          // Merge: cloud is source of truth, but preserve local-only items
          const localCases = getCases();
          const cloudIds = new Set(cloudCases.map(c => c.id));
          const localOnly = localCases.filter(c => !cloudIds.has(c.id));
          const merged = [...cloudCases, ...localOnly];
          localStorage.setItem('se-pbl-cases', JSON.stringify(merged));
          // Upload local-only items to cloud
          if (localOnly.length > 0) {
            for (const c of localOnly) {
              await window.StarEarthDB.saveCase(c).catch(() => {});
            }
          }
        } else if (getCases().length > 0) {
          // Cloud is empty but local has data — upload
          await window.StarEarthDB.saveCases(getCases()).catch(() => {});
        }
        updateCount();
        renderCaseList();
      } catch (e) { console.warn('Cloud cases init failed:', e); }
    }
  })();
  // Check if file data is available (either inline or in IndexedDB)
  function hasFileData(file) {
    if (!file || !file.dataUrl) return false;
    return file.dataUrl === '__idb__' || file.dataUrl.length > 50;
  }

  // Load file data from IndexedDB if needed
  async function loadFileData(caseId, fileIndex, file) {
    if (!file) return null;
    if (file.dataUrl === '__idb__') {
      const key = caseId + '_f' + fileIndex;
      const data = await FileStore.get(key);
      if (data) {
        file.dataUrl = data; // Cache in memory
      }
      return data;
    }
    return file.dataUrl;
  }
  updateCount();

  // ---- Filters ----
  let filterMod = 'all';
  let filterAge = 'all';
  let searchKeyword = '';

  // Inject search styles
  (function injectSearchStyles() {
    const s = document.createElement('style');
    s.textContent = `
      .case-search-wrap {
        position: relative; margin: 12px 0 16px; display: flex; align-items: center;
      }
      .case-search-icon {
        position: absolute; left: 14px; font-size: 1rem; pointer-events: none; z-index: 1;
      }
      .case-search-input {
        width: 100%; padding: 11px 40px 11px 42px;
        border: 1px solid var(--border, #333); border-radius: 12px;
        background: var(--bg, #141420); color: var(--text, #e8e6e1);
        font-size: 0.88rem; font-family: var(--font-sans, 'Noto Sans SC', sans-serif);
        transition: border-color 0.2s, box-shadow 0.2s;
        outline: none;
      }
      .case-search-input::placeholder { color: var(--text-muted, #666); }
      .case-search-input:focus {
        border-color: var(--accent-brand, #c5a44e);
        box-shadow: 0 0 0 3px rgba(197,164,78,0.15);
      }
      .case-search-clear {
        position: absolute; right: 10px; background: none; border: none;
        color: var(--text-muted, #666); font-size: 1rem; cursor: pointer;
        padding: 4px 8px; border-radius: 6px; transition: color 0.2s;
      }
      .case-search-clear:hover { color: var(--text, #e8e6e1); }
      .case-search-highlight {
        background: rgba(197,164,78,0.25); border-radius: 2px; padding: 0 1px;
      }
    `;
    document.head.appendChild(s);
  })();

  document.querySelectorAll('.filter-chip[data-mod]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-mod]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterMod = chip.dataset.mod;
      renderCaseList();
    });
  });
  document.querySelectorAll('.filter-chip[data-age]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-age]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterAge = chip.dataset.age;
      renderCaseList();
    });
  });

  // ---- Search ----
  const searchInput = document.getElementById('case-search');
  const searchClearBtn = document.getElementById('case-search-clear');
  let searchDebounce = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        searchKeyword = searchInput.value.trim().toLowerCase();
        searchClearBtn.style.display = searchKeyword ? '' : 'none';
        renderCaseList();
      }, 200);
    });
  }
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchKeyword = '';
      searchClearBtn.style.display = 'none';
      renderCaseList();
      searchInput.focus();
    });
  }

  // ---- Multi-File Upload ----
  let pptFilesData = []; // Array of { name, size, type, dataUrl }

  const uploadZone = document.getElementById('ppt-upload-zone');
  const fileInput = document.getElementById('ppt-file-input');
  const filesListEl = document.getElementById('ppt-files-list');

  const ALLOWED_TYPES = [
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ];
  const ALLOWED_EXTENSIONS = ['.ppt', '.pptx', '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file

  function getFileExtension(filename) {
    return '.' + filename.split('.').pop().toLowerCase();
  }

  function getFileIcon(filename) {
    const ext = getFileExtension(filename);
    if (ext === '.pdf') return '📕';
    if (ext === '.pptx' || ext === '.ppt') return '📊';
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return '🖼️';
    return '📄';
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function isValidFile(file) {
    const ext = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      showToast('⚠️ 不支持的文件格式：' + file.name, 'error');
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast('⚠️ 文件过大：' + file.name + '（最大 50MB）', 'error');
      return false;
    }
    // Check for duplicates
    if (pptFilesData.some(f => f.name === file.name && f.size === file.size)) {
      showToast('ℹ️ 文件已存在：' + file.name, 'error');
      return false;
    }
    return true;
  }

  function handleFiles(files) {
    const validFiles = Array.from(files).filter(f => isValidFile(f));
    let loaded = 0;
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = function(e) {
        pptFilesData.push({
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: e.target.result
        });
        loaded++;
        if (loaded === validFiles.length) {
          renderFilesList();
          if (validFiles.length > 0) {
            showToast('✅ 已添加 ' + validFiles.length + ' 个文件', 'success');
          }
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function renderFilesList() {
    if (pptFilesData.length === 0) {
      filesListEl.innerHTML = '';
      return;
    }
    const totalSize = pptFilesData.reduce((s, f) => s + f.size, 0);
    filesListEl.innerHTML = '<div class="ppt-files-header">' +
      '<span>已选 ' + pptFilesData.length + ' 个文件 (' + formatFileSize(totalSize) + ')</span>' +
      '<button type="button" class="ppt-clear-all" onclick="window.__clearAllFiles()">全部清除</button>' +
      '</div>' +
      pptFilesData.map((f, i) =>
        '<div class="ppt-file-item">' +
        '<div class="ppt-file-item-info">' +
        '<span class="ppt-preview-icon">' + getFileIcon(f.name) + '</span>' +
        '<div class="ppt-preview-details">' +
        '<span class="ppt-preview-name">' + esc(f.name) + '</span>' +
        '<span class="ppt-preview-size">' + formatFileSize(f.size) + '</span>' +
        '</div></div>' +
        '<button type="button" class="ppt-preview-remove" onclick="window.__removeFile(' + i + ')" title="移除">✕</button>' +
        '</div>'
      ).join('');
  }

  window.__removeFile = function(i) {
    pptFilesData.splice(i, 1);
    renderFilesList();
  };

  window.__clearAllFiles = function() {
    pptFilesData = [];
    fileInput.value = '';
    renderFilesList();
  };

  // Click to browse
  uploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFiles(e.target.files);
    fileInput.value = ''; // Reset so same files can be re-selected
  });

  // Drag and drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });
  uploadZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
  });
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  });

  // ---- Form Validation ----
  const requiredFields = ['c-title', 'c-teacher', 'c-age', 'c-eq', 'c-knowledge', 'c-handson', 'c-highlights'];
  const btnSubmit = document.getElementById('btn-submit');

  function validateForm() {
    const allFilled = requiredFields.every(id => {
      const el = document.getElementById(id);
      return el && el.value.trim() !== '';
    });
    const moduleChecked = document.querySelectorAll('#c-modules input:checked').length > 0;
    btnSubmit.disabled = !(allFilled && moduleChecked);
  }

  document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => {
    el.addEventListener('input', validateForm);
  });
  document.querySelectorAll('#c-modules input').forEach(el => {
    el.addEventListener('change', validateForm);
  });

  // ---- Form Submit ----
  document.getElementById('case-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    btnSubmit.disabled = true;
    btnSubmit.textContent = '正在保存...';

    const modules = [];
    document.querySelectorAll('#c-modules input:checked').forEach(cb => modules.push(cb.value));

    // Build files array with original dataUrls
    const filesArr = pptFilesData.map(f => ({
      name: f.name, size: f.size, type: f.type, dataUrl: f.dataUrl
    }));

    const cases = getCases();
    const isEditing = editingCaseIndex !== null && cases[editingCaseIndex];
    const existingCase = isEditing ? cases[editingCaseIndex] : null;
    const caseId = isEditing ? existingCase.id : ('pbl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));

    const pblCase = {
      id: caseId,
      title: val('c-title'),
      teacher: val('c-teacher') || (window.StarEarthIdentity && window.StarEarthIdentity.getSavedIdentity() ? window.StarEarthIdentity.getSavedIdentity().name : '匿名'),
      age: val('c-age'),
      type: val('c-type'),
      modules: modules,
      eq: val('c-eq'),
      knowledge: val('c-knowledge'),
      design: val('c-design'),
      handson: val('c-handson'),
      reflect: val('c-reflect'),
      background: val('c-background'),
      highlights: val('c-highlights'),
      pitfalls: val('c-pitfalls'),
      pptFile: null,
      pptFiles: null,
      // Preserve existing data when editing
      likes: existingCase ? existingCase.likes : 0,
      likedBy: existingCase ? existingCase.likedBy : [],
      comments: existingCase ? existingCase.comments : [],
      submittedAt: existingCase ? existingCase.submittedAt : new Date().toISOString()
    };

    try {
      // Clean up old IDB files if editing
      if (isEditing) {
        const oldFiles = existingCase.pptFiles || (existingCase.pptFile ? [existingCase.pptFile] : []);
        for (let i = 0; i < oldFiles.length; i++) {
          try { await FileStore.delete(caseId + '_f' + i); } catch(e) { /* ignore */ }
        }
      }

      // Save new file data to IndexedDB
      for (let i = 0; i < filesArr.length; i++) {
        const f = filesArr[i];
        if (f.dataUrl && f.dataUrl !== '__idb__') {
          const key = caseId + '_f' + i;
          await FileStore.save(key, f.dataUrl);
          filesArr[i] = { name: f.name, size: f.size, type: f.type, dataUrl: '__idb__' };
        }
      }

      // Save case metadata
      pblCase.pptFiles = filesArr.length > 0 ? filesArr : null;
      pblCase.pptFile = filesArr.length > 0 ? filesArr[0] : null;

      if (isEditing) {
        cases[editingCaseIndex] = pblCase;
      } else {
        cases.push(pblCase);
      }
      saveCases(cases);

      const fileCount = filesArr.length;
      showToast(isEditing ? '✅ 案例已更新！' : '✅ 案例已上传！' + (fileCount > 0 ? ' (含 ' + fileCount + ' 个附件)' : ''), 'success');
    } catch (err) {
      console.error('Save error:', err);
      showToast('⚠️ 保存失败：' + err.message, 'error');
    }

    document.getElementById('case-form').reset();
    pptFilesData = [];
    renderFilesList();
    editingCaseIndex = null;
    btnSubmit.textContent = '上传案例';
    validateForm();
    updateCount();

    setTimeout(() => { document.getElementById('tab-btn-list').click(); }, 600);
  });

  // ---- Render Case List ----
  function renderCaseList() {
    let cases = getCases();
    if (filterMod !== 'all') cases = cases.filter(c => c.modules.includes(filterMod));
    if (filterAge !== 'all') cases = cases.filter(c => c.age === filterAge);

    // Keyword search
    if (searchKeyword) {
      cases = cases.filter(c => {
        const searchFields = [
          c.title, c.eq, c.teacher, c.background, c.highlights, c.pitfalls,
          c.knowledge, c.design, c.handson, c.reflect,
          ...(c.modules || [])
        ].filter(Boolean).join(' ').toLowerCase();
        return searchFields.includes(searchKeyword);
      });
    }

    const listEl = document.getElementById('case-list');
    if (cases.length === 0) {
      const total = getCases().length;
      const msg = total === 0
        ? '还没有上传的案例。<br>切换到「上传案例」分享你的教学经验！'
        : searchKeyword
          ? `没有找到包含「<strong>${esc(searchKeyword)}</strong>」的案例。`
          : '当前筛选条件下没有匹配的案例。';
      listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><h3>暂无案例</h3><p>${msg}</p></div>`;
      return;
    }

    const allCases = getCases();
    listEl.innerHTML = cases.map((c) => {
      const realIndex = allCases.findIndex(ac => ac.id === c.id);
      return renderCaseCard(c, realIndex);
    }).join('');
  }

  function renderCaseCard(c, realIndex) {
    const date = new Date(c.submittedAt).toLocaleDateString('zh-CN');
    const modTags = c.modules.map(m => {
      const icons = { 'STEAM': '🔬', '人文与思辨': '📚', '玩耍与体育': '⚽', '自然与生活': '🌿' };
      return `<span class="case-card-tag">${icons[m] || ''} ${esc(m)}</span>`;
    }).join('');

    // Get all files (support both old pptFile and new pptFiles format)
    const allFiles = c.pptFiles || (c.pptFile ? [c.pptFile] : []);
    const fileCount = allFiles.length;
    const pptBadge = fileCount > 0
      ? `<span class="case-card-ppt-badge">📎 ${fileCount > 1 ? fileCount + ' 个附件' : (allFiles[0].name && ['.jpg','.jpeg','.png','.gif','.webp'].includes(getFileExtension(allFiles[0].name)) ? '图片' : '附件')}</span>`
      : '';

    // Show edit/delete only for the case author
    const identity = window.StarEarthIdentity && window.StarEarthIdentity.getSavedIdentity();
    const isAuthor = identity && c.teacher === identity.name;
    const authorActions = isAuthor
      ? `<div class="case-card-actions">
           <button class="case-action-btn case-edit-btn" onclick="event.stopPropagation();window.__editCase(${realIndex})" title="编辑">✏️</button>
           <button class="case-action-btn case-delete-btn" onclick="event.stopPropagation();window.__deleteCase(${realIndex})" title="删除">🗑️</button>
         </div>`
      : '';

    return `
    <div class="case-card" onclick="window.__openCase(${realIndex})">
      ${authorActions}
      <div class="case-card-tags">${modTags}<span class="case-card-tag tag-age">${esc(c.age)}</span>${pptBadge}</div>
      <h3 class="case-card-title">${esc(c.title)}</h3>
      <p class="case-card-eq">"${esc(c.eq)}"</p>
      <div class="case-card-footer">
        <span class="case-card-teacher">👤 ${esc(c.teacher)} · ${date}</span>
        <div class="case-card-stats">
          <span class="case-stat" onclick="event.stopPropagation();window.__likeCase(${realIndex},this)">👍 ${c.likes || 0}</span>
          <span class="case-stat">💬 ${(c.comments || []).length}</span>
        </div>
      </div>
    </div>`;
  }

  // ---- Like ----
  window.__likeCase = function(index, el) {
    const cases = getCases();
    const c = cases[index];
    const username = window.StarEarthIdentity?.getSavedIdentity()?.name || 'anonymous';
    c.likedBy = c.likedBy || [];
    
    if (c.likedBy.includes(username)) {
      showToast('⚠️ 你已经点过赞啦', 'error');
      return;
    }
    
    c.likes = (c.likes || 0) + 1;
    c.likedBy.push(username);
    saveCases(cases);
    renderCaseList();
    showToast('👍 已点赞！', 'success');
  };

  // ---- Delete Case ----
  window.__deleteCase = async function(index) {
    if (!confirm('确定要删除这个案例吗？此操作不可撤销。')) return;
    const cases = getCases();
    const c = cases[index];
    if (!c) return;

    // Clean up IDB files
    const allFiles = c.pptFiles || (c.pptFile ? [c.pptFile] : []);
    for (let i = 0; i < allFiles.length; i++) {
      try { await FileStore.delete(c.id + '_f' + i); } catch(e) { /* ignore */ }
    }

    cases.splice(index, 1);
    saveCases(cases);
    updateCount();
    renderCaseList();
    showToast('🗑️ 案例已删除', 'success');
  };

  // ---- Edit Case ----
  let editingCaseIndex = null; // Track which case is being edited

  window.__editCase = async function(index) {
    const cases = getCases();
    const c = cases[index];
    if (!c) return;

    editingCaseIndex = index;

    // Switch to upload tab
    document.querySelectorAll('.topic-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.topic-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="upload"]').classList.add('active');
    document.getElementById('panel-upload').classList.add('active');

    // Pre-fill form fields
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    setVal('c-title', c.title);
    setVal('c-teacher', c.teacher);
    setVal('c-age', c.age);
    setVal('c-type', c.type);
    setVal('c-eq', c.eq);
    setVal('c-knowledge', c.knowledge);
    setVal('c-design', c.design);
    setVal('c-handson', c.handson);
    setVal('c-reflect', c.reflect);
    setVal('c-background', c.background);
    setVal('c-highlights', c.highlights);
    setVal('c-pitfalls', c.pitfalls);

    // Set module checkboxes
    document.querySelectorAll('#c-modules input').forEach(cb => {
      cb.checked = (c.modules || []).includes(cb.value);
    });

    // Load existing files from IDB into the upload list
    pptFilesData = [];
    const allFiles = c.pptFiles || (c.pptFile ? [c.pptFile] : []);
    for (let i = 0; i < allFiles.length; i++) {
      const f = allFiles[i];
      let dataUrl = f.dataUrl;
      if (dataUrl === '__idb__') {
        dataUrl = await FileStore.get(c.id + '_f' + i);
      }
      if (dataUrl) {
        pptFilesData.push({ name: f.name, size: f.size, type: f.type, dataUrl: dataUrl });
      }
    }
    renderFilesList();

    // Update submit button
    btnSubmit.textContent = '💾 保存修改';
    btnSubmit.disabled = false;
    validateForm();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('✏️ 正在编辑案例：' + c.title, 'success');
  };

  // ---- Open Detail Modal ----
  window.__openCase = function(index) {
    const c = getCases()[index];
    if (!c) return;
    const modal = document.getElementById('case-modal');
    const content = document.getElementById('case-modal-content');

    const modTags = c.modules.map(m => `<span class="case-card-tag">${esc(m)}</span>`).join('');
    const date = new Date(c.submittedAt).toLocaleDateString('zh-CN');


    // Files section (support both pptFiles array and legacy pptFile)
    const allFiles = c.pptFiles || (c.pptFile ? [c.pptFile] : []);
    let pptSection = '';
    if (allFiles.length > 0) {
      const fileItems = allFiles.map((file, fi) => {
        const ext = file.name.split('.').pop().toUpperCase();
        const fileSize = formatFileSize(file.size);
        const hasData = hasFileData(file);
        const fileExt = getFileExtension(file.name);
        const canPreview = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExt);

        if (hasData) {
          const previewBtn = canPreview
            ? `<button class="ppt-preview-btn" onclick="event.stopPropagation();window.__previewSingleFile(${index},${fi})">
                 <span class="ppt-btn-icon">👁️</span> 查看
               </button>`
            : '';
          return `<div class="ppt-action-group" style="margin-bottom:8px">
              <button class="ppt-download-btn" onclick="event.stopPropagation();window.__downloadFile(${index},${fi})">
                <span class="ppt-btn-icon">${getFileIcon(file.name)}</span>
                下载 ${esc(file.name)}
                <span class="ppt-file-tag">${ext}</span>
              </button>
              ${previewBtn}
            </div>
            <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:12px">${fileSize}</p>`;
        } else {
          return `<p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px">
              ${getFileIcon(file.name)} ${esc(file.name)} (${fileSize})
              <br><span style="font-size:0.78rem;color:var(--text-muted)">该文件需从原上传者处获取</span>
            </p>`;
        }
      }).join('');

      pptSection = `
          <div class="case-detail-section ppt-download-section">
            <h4>📎 案例附件 (${allFiles.length})</h4>
            ${fileItems}
          </div>`;
    }

    content.innerHTML = `
      <div class="case-detail-header">
        <h2>${esc(c.title)}</h2>
        <div class="case-detail-meta">
          ${modTags}
          <span class="case-card-tag tag-age">${esc(c.age)}</span>
          <span class="case-card-tag">${esc(c.type)}</span>
          <span style="margin-left:auto;font-size:0.8rem;color:var(--text-muted)">👤 ${esc(c.teacher)} · ${date}</span>
        </div>
      </div>

      ${c.background ? `<div class="case-detail-section"><h4>📋 案例背景</h4><p>${esc(c.background)}</p></div>` : ''}

      <div class="case-detail-section">
        <h4>🔄 PBL 五步流程</h4>
        <div class="pbl-flow-display">
          <div class="pbl-flow-item"><span class="pbl-flow-badge">①</span><div><strong>驱动问题</strong><p>${esc(c.eq)}</p></div></div>
          <div class="pbl-flow-item"><span class="pbl-flow-badge">②</span><div><strong>知识构建</strong><p>${esc(c.knowledge)}</p></div></div>
          ${c.design ? `<div class="pbl-flow-item"><span class="pbl-flow-badge">③</span><div><strong>方案设计</strong><p>${esc(c.design)}</p></div></div>` : ''}
          <div class="pbl-flow-item"><span class="pbl-flow-badge">④</span><div><strong>动手实践</strong><p>${esc(c.handson)}</p></div></div>
          ${c.reflect ? `<div class="pbl-flow-item"><span class="pbl-flow-badge">⑤</span><div><strong>展示与反思</strong><p>${esc(c.reflect)}</p></div></div>` : ''}
        </div>
      </div>

      <div class="case-detail-section highlight-section">
        <h4>💎 亮点与心得</h4>
        <p>${esc(c.highlights)}</p>
      </div>

      ${c.pitfalls ? `<div class="case-detail-section pitfall-section"><h4>⚠️ 踩坑与改进</h4><p>${esc(c.pitfalls)}</p></div>` : ''}

      ${pptSection}

      <!-- Comments -->
      <div class="case-detail-section">
        <h4>💬 评论 (${(c.comments || []).length})</h4>
        <div class="case-comments">
          ${(c.comments || []).map(cm => `
            <div class="case-comment">
              <div class="case-comment-header"><strong>${esc(cm.author)}</strong><span>${new Date(cm.date).toLocaleDateString('zh-CN')}</span></div>
              <p>${esc(cm.text)}</p>
            </div>
          `).join('') || '<p style="color:var(--text-muted);font-size:0.85rem">暂无评论</p>'}
        </div>
        <div class="case-comment-form">
          <div id="comment-author-display" style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px">评论身份：<strong id="comment-author-name">加载中...</strong></div>
          <textarea class="form-textarea" id="comment-text" placeholder="写下你的想法..." style="min-height:60px"></textarea>
          <button type="button" class="btn-submit-review" onclick="window.__addComment(${index})">发布评论</button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Auto-fill comment author from identity
    setTimeout(() => {
      const nameEl = document.getElementById('comment-author-name');
      if (nameEl && window.StarEarthIdentity) {
        const identity = window.StarEarthIdentity.getSavedIdentity();
        nameEl.textContent = identity ? identity.name : '未登录（请先登录）';
      }
    }, 50);
  };

  // ---- Download / Save File ----
  // Helper to get file object from case (supports multi-file + IDB)
  async function getCaseFileAsync(caseIndex, fileIndex) {
    const c = getCases()[caseIndex];
    if (!c) return null;
    const allFiles = c.pptFiles || (c.pptFile ? [c.pptFile] : []);
    const fi = fileIndex || 0;
    const file = allFiles[fi] || null;
    if (!file) return null;
    // Load data from IndexedDB if needed
    if (file.dataUrl === '__idb__') {
      const key = c.id + '_f' + fi;
      const data = await FileStore.get(key);
      if (data) file.dataUrl = data;
      else { file.dataUrl = null; }
    }
    return file;
  }

  function downloadFileData(fileObj) {
    if (!fileObj || !fileObj.dataUrl || fileObj.dataUrl === '__idb__') {
      showToast('⚠️ 文件不可用', 'error');
      return;
    }
    try {
      const dataUrl = fileObj.dataUrl;
      const parts = dataUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)[1];
      const bstr = atob(parts[1]);
      const n = bstr.length;
      const u8arr = new Uint8Array(n);
      for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
      const fileName = fileObj.name;
      const fileExt = getFileExtension(fileName);
      const blob = new Blob([u8arr], { type: mime });

      // Method 1: File System Access API (showSaveFilePicker)
      if (window.showSaveFilePicker) {
        const acceptMap = {};
        if (fileExt === '.pdf') acceptMap['application/pdf'] = ['.pdf'];
        else if (fileExt === '.pptx') acceptMap['application/vnd.openxmlformats-officedocument.presentationml.presentation'] = ['.pptx'];
        else if (fileExt === '.ppt') acceptMap['application/vnd.ms-powerpoint'] = ['.ppt'];
        else if (['.jpg', '.jpeg'].includes(fileExt)) acceptMap['image/jpeg'] = ['.jpg', '.jpeg'];
        else if (fileExt === '.png') acceptMap['image/png'] = ['.png'];
        else if (fileExt === '.gif') acceptMap['image/gif'] = ['.gif'];
        else if (fileExt === '.webp') acceptMap['image/webp'] = ['.webp'];
        else acceptMap['application/octet-stream'] = [fileExt];

        showToast('💾 请在弹窗中选择保存位置...', 'success');
        window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: fileName, accept: acceptMap }]
        }).then(function(handle) {
          return handle.createWritable();
        }).then(function(writable) {
          return writable.write(blob).then(function() { return writable.close(); });
        }).then(function() {
          showToast('✅ 文件已保存：' + fileName, 'success');
        }).catch(function(e) {
          if (e.name === 'AbortError') {
            showToast('ℹ️ 已取消保存', 'error');
          } else {
            console.error('Save error:', e);
            fallbackDownload(blob, fileName);
          }
        });
        return;
      }

      // Method 2: <a download> fallback
      fallbackDownload(blob, fileName);
    } catch (err) {
      console.error('Download error:', err);
      showToast('⚠️ 下载失败', 'error');
    }
  }

  // Download specific file by index (async for IDB loading)
  window.__downloadFile = async function(caseIndex, fileIndex) {
    showToast('⏳ 正在加载文件...', 'success');
    const file = await getCaseFileAsync(caseIndex, fileIndex);
    downloadFileData(file);
  };

  // Backward compat: download first file
  window.__downloadPpt = async function(index) {
    showToast('⏳ 正在加载文件...', 'success');
    const file = await getCaseFileAsync(index, 0);
    downloadFileData(file);
  };

  function fallbackDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(function() { document.body.removeChild(link); URL.revokeObjectURL(url); }, 1000);
    showToast('📥 开始下载：' + fileName, 'success');
  }

  function previewFileData(fileObj, caseIndex, fileIndex) {
    if (!fileObj || !fileObj.dataUrl || fileObj.dataUrl === '__idb__') {
      showToast('⚠️ 文件不可用', 'error');
      return;
    }

    const fileExt = getFileExtension(fileObj.name);
    const previewOverlay = document.getElementById('file-preview-modal');
    const previewContent = document.getElementById('file-preview-content');
    const previewTitle = document.getElementById('file-preview-title');

    previewTitle.textContent = fileObj.name;

    try {
      const dataUrl = fileObj.dataUrl;
      const parts = dataUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)[1];
      const bstr = atob(parts[1]);
      const n = bstr.length;
      const u8arr = new Uint8Array(n);
      for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);

      if (fileExt === '.pdf') {
        previewContent.innerHTML = `<iframe src="${blobUrl}" class="file-preview-iframe"></iframe>`;
      } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExt)) {
        previewContent.innerHTML = `<img src="${blobUrl}" class="file-preview-image" alt="${esc(fileObj.name)}">`;
      } else {
        previewContent.innerHTML = `<div class="file-preview-unsupported">
          <div style="font-size:3rem;margin-bottom:16px">${getFileIcon(fileObj.name)}</div>
          <p>该文件格式暂不支持在线预览</p>
          <button class="ppt-download-btn" onclick="window.__downloadFile(${caseIndex},${fileIndex})" style="margin-top:16px">
            <span class="ppt-btn-icon">📥</span> 下载文件查看
          </button>
        </div>`;
      }

      previewOverlay._blobUrl = blobUrl;
      previewOverlay.style.display = 'flex';
    } catch (err) {
      console.error('Preview error:', err);
      showToast('⚠️ 预览失败', 'error');
    }
  }

  // Preview specific file by index (async for IDB loading)
  window.__previewSingleFile = async function(caseIndex, fileIndex) {
    showToast('⏳ 正在加载预览...', 'success');
    const file = await getCaseFileAsync(caseIndex, fileIndex);
    previewFileData(file, caseIndex, fileIndex);
  };

  // Backward compat: preview first file
  window.__previewFile = async function(index) {
    showToast('⏳ 正在加载预览...', 'success');
    const file = await getCaseFileAsync(index, 0);
    previewFileData(file, index, 0);
  };

  // ---- Close Preview ----
  window.__closePreview = function() {
    const previewOverlay = document.getElementById('file-preview-modal');
    const previewContent = document.getElementById('file-preview-content');
    // Revoke blob URL to free memory
    if (previewOverlay._blobUrl) {
      URL.revokeObjectURL(previewOverlay._blobUrl);
      previewOverlay._blobUrl = null;
    }
    previewContent.innerHTML = '';
    previewOverlay.style.display = 'none';
  };

  // Close preview on overlay click
  document.getElementById('file-preview-modal').addEventListener('click', function(e) {
    if (e.target === this) window.__closePreview();
  });

  window.__closeModal = function() {
    document.getElementById('case-modal').style.display = 'none';
    document.body.style.overflow = '';
  };

  // Close on overlay click
  document.getElementById('case-modal').addEventListener('click', function(e) {
    if (e.target === this) window.__closeModal();
  });

  // ---- Add Comment ----
  window.__addComment = function(index) {
    // Get author from identity system
    const identity = window.StarEarthIdentity ? window.StarEarthIdentity.getSavedIdentity() : null;
    const author = identity ? identity.name : '';
    const text = document.getElementById('comment-text').value.trim();
    if (!author) { showToast('⚠️ 请先登录再发表评论', 'error'); return; }
    if (!text) { showToast('⚠️ 请输入评论内容', 'error'); return; }

    const cases = getCases();
    if (!cases[index].comments) cases[index].comments = [];
    cases[index].comments.push({ author, text, date: new Date().toISOString() });
    saveCases(cases);

    showToast('💬 评论已发布！', 'success');
    window.__openCase(index); // Re-render modal
    renderCaseList();
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

  // Initial render
  renderCaseList();

  // Global wrapper for renderCaseList (callable from inline onclick)
  window.__showAllCases = function() { renderCaseList(); };

  // ---- Personal Center Panel ----
  window.__toggleUserPanel = function() {
    const panel = document.getElementById('user-panel');
    if (!panel) return;
    const identity = window.StarEarthIdentity && window.StarEarthIdentity.getSavedIdentity();
    if (!identity) {
      // Not logged in, trigger login
      window.__switchUser && window.__switchUser();
      return;
    }

    const isVisible = panel.style.display !== 'none';
    if (isVisible) {
      panel.style.display = 'none';
      return;
    }

    // Populate panel data
    const cases = getCases();
    const myCases = cases.filter(c => c.teacher === identity.name);
    const totalLikes = myCases.reduce((s, c) => s + (c.likes || 0), 0);
    const totalFiles = myCases.reduce((s, c) => {
      const f = c.pptFiles || (c.pptFile ? [c.pptFile] : []);
      return s + f.length;
    }, 0);

    const roleMap = { 'teacher': '教师', 'ops': '运营', 'admin': '管理' };
    document.getElementById('panel-avatar').textContent = identity.name.charAt(0);
    document.getElementById('panel-name').textContent = identity.name;
    document.getElementById('panel-role').textContent = roleMap[identity.role] || '教师';
    document.getElementById('stat-cases').textContent = myCases.length;
    document.getElementById('stat-likes').textContent = totalLikes;
    document.getElementById('stat-files').textContent = totalFiles;

    // Show recent cases (max 3)
    const caseListEl = document.getElementById('panel-cases-list');
    if (myCases.length > 0) {
      const recent = myCases.slice(-3).reverse();
      caseListEl.innerHTML = '<div class="panel-cases-title">📝 最近上传</div>' +
        recent.map(c => {
          const idx = cases.findIndex(ac => ac.id === c.id);
          const date = new Date(c.submittedAt).toLocaleDateString('zh-CN');
          return '<div class="panel-case-item" onclick="window.__openCase(' + idx + ');document.getElementById(\'user-panel\').style.display=\'none\'">' +
            '<span class="panel-case-title">' + esc(c.title) + '</span>' +
            '<span class="panel-case-meta">👍' + (c.likes || 0) + ' · ' + date + '</span>' +
            '</div>';
        }).join('');
    } else {
      caseListEl.innerHTML = '<div class="panel-cases-empty">还没有上传案例</div>';
    }

    panel.style.display = 'block';
  };

  // Filter to show only current user's cases
  window.__filterMyCases = function() {
    document.getElementById('user-panel').style.display = 'none';
    const identity = window.StarEarthIdentity && window.StarEarthIdentity.getSavedIdentity();
    if (!identity) return;

    // Switch to list tab
    document.querySelectorAll('.topic-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.topic-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="list"]').classList.add('active');
    document.getElementById('panel-list').classList.add('active');

    // Render only user's cases
    const allCases = getCases();
    const myCases = allCases.filter(c => c.teacher === identity.name);
    const listEl = document.getElementById('case-list');

    if (myCases.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><h3>暂无案例</h3><p>你还没有上传任何案例。</p></div>';
      return;
    }

    listEl.innerHTML = '<div class="my-cases-banner">📋 我的案例 (' + myCases.length + ')<button class="my-cases-clear" onclick="window.__showAllCases()">显示全部</button></div>' +
      myCases.map(c => {
        const realIndex = allCases.findIndex(ac => ac.id === c.id);
        return renderCaseCard(c, realIndex);
      }).join('');
  };

  // Close panel on outside click
  document.addEventListener('click', function(e) {
    const panel = document.getElementById('user-panel');
    const wrapper = document.getElementById('nav-user-wrapper');
    if (panel && wrapper && !wrapper.contains(e.target)) {
      panel.style.display = 'none';
    }
  });
})();
