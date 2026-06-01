/**
 * StarEarth — 用户身份识别模块（含密码验证 + 管理员密钥）
 * 管理员注册需要输入机构密钥 xinyutu2026
 * 页面内容在登录前完全隐藏，不允许游客访问
 */
(function() {
  'use strict';

  // Block all page content until logged in
  const blockStyle = document.createElement('style');
  blockStyle.id = 'se-content-blocker';
  blockStyle.textContent = `
    body.se-locked > *:not(.identity-modal-overlay):not(#se-content-blocker) {
      visibility: hidden !important;
      pointer-events: none !important;
    }
    body.se-locked .identity-modal-overlay {
      visibility: visible !important;
      pointer-events: auto !important;
    }
  `;
  document.head.appendChild(blockStyle);
  document.documentElement.classList.add('se-loading');

  const STORAGE_KEY = 'se-user-identity';
  const USERS_KEY = 'se-registered-users';
  const ADMIN_SECRET = 'xinyutu2026';

  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + '_stareaRth_salt_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function getRegisteredUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
    catch { return []; }
  }

  // Load cloud users into local on page load (async, fire-and-forget)
  (async function syncUsersFromCloud() {
    if (!window.StarEarthDB || !window.StarEarthDB.isSupabaseReady()) return;
    try {
      const cloudUsers = await window.StarEarthDB.getAllUsers();
      if (!cloudUsers || cloudUsers.length === 0) return;
      const localUsers = getRegisteredUsers();
      // Merge: update local users' banned status, password_hash, role from cloud
      cloudUsers.forEach(cu => {
        let local = localUsers.find(lu => lu.name === cu.name);
        if (local) {
          local.banned = cu.banned === true;
          if (cu.password_hash) local.passwordHash = cu.password_hash;
          // 核心修复：防止因为云端未及时同步或初始状态不符，将本地已验证的管理员（admin）降级为普通教师
          if (cu.role) {
            if (local.role !== 'admin' || cu.role === 'admin') {
              local.role = cu.role;
            }
          }
        } else {
          // If user exists in cloud but not local, add them locally
          localUsers.push({
            name: cu.name,
            role: cu.role || 'teacher',
            passwordHash: cu.password_hash,
            banned: cu.banned === true,
            createdAt: cu.created_at || new Date().toISOString()
          });
        }
      });
      localStorage.setItem(USERS_KEY, JSON.stringify(localUsers));
    } catch (err) {
      console.warn('⚠️ syncUsersFromCloud failed:', err);
    }
  })();

  function saveRegisteredUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    // Cloud sync
    if (window.StarEarthDB && window.StarEarthDB.isSupabaseReady()) {
      window.StarEarthDB.syncUsers(users).catch(e => console.warn('User cloud sync failed:', e));
    }
  }

  function findUser(name) {
    return getRegisteredUsers().find(u => u.name === name);
  }

  function getSavedIdentity() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      const parsed = JSON.parse(data);
      if (parsed && parsed.name) return parsed;
      return null;
    } catch { return null; }
  }

  function saveIdentity(name, role) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, role }));
  }

  function clearIdentity() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function updateNavUser(name) {
    const nameEl = document.getElementById('nav-user-name');
    const avatarEl = document.getElementById('nav-user-avatar');
    if (nameEl) nameEl.textContent = name || '未登录';
    if (avatarEl) avatarEl.textContent = name ? name.charAt(0) : '?';
  }

  function setError(msg) {
    const el = document.getElementById('identity-error');
    if (el) el.textContent = msg || '';
  }

  // Show/hide admin key field based on role selection
  function toggleAdminKeyField() {
    const roleSelect = document.getElementById('identity-role');
    const keyWrap = document.getElementById('admin-key-wrap');
    if (!roleSelect || !keyWrap) return;
    keyWrap.style.display = roleSelect.value === 'admin' ? 'block' : 'none';
  }

  function updateModalUI(name) {
    const titleEl = document.getElementById('identity-modal-title');
    const descEl = document.getElementById('identity-modal-desc');
    const confirmBtn = document.getElementById('identity-confirm');
    const passwordEl = document.getElementById('identity-password');
    const roleSelect = document.getElementById('identity-role');
    const hintEl = document.getElementById('identity-hint');
    const inviteWrap = document.getElementById('invite-code-wrap');

    const user = name ? findUser(name) : null;

    if (user) {
      if (titleEl) titleEl.textContent = '🔑 登录';
      if (descEl) descEl.textContent = '欢迎回来，' + user.name;
      if (passwordEl) passwordEl.placeholder = '请输入密码';
      if (confirmBtn) confirmBtn.textContent = '登录';
      if (roleSelect) {
        roleSelect.parentElement.style.display = 'flex';
        roleSelect.value = user.role || 'teacher';
      }
      if (hintEl) hintEl.textContent = '请输入密码，可切换角色登录';
      if (inviteWrap) inviteWrap.style.display = 'none';
      toggleAdminKeyField();
    } else if (name && name.trim()) {
      if (titleEl) titleEl.textContent = '📝 注册新账号';
      if (descEl) descEl.textContent = '「' + name + '」是新用户，请设置密码';
      if (passwordEl) passwordEl.placeholder = '设置密码（至少4位）';
      if (confirmBtn) confirmBtn.textContent = '注册';
      if (roleSelect) roleSelect.parentElement.style.display = 'flex';
      if (hintEl) hintEl.textContent = '请牢记你的密码，下次登录需要使用';
      if (inviteWrap) inviteWrap.style.display = 'block';
      toggleAdminKeyField();
    } else {
      if (titleEl) titleEl.textContent = '🔐 登录 / 注册';
      if (descEl) descEl.textContent = '请输入姓名和密码';
      if (passwordEl) passwordEl.placeholder = '设置密码（首次为注册）';
      if (confirmBtn) confirmBtn.textContent = '登录 / 注册';
      if (roleSelect) roleSelect.parentElement.style.display = 'flex';
      if (hintEl) hintEl.textContent = '首次输入姓名将自动注册，再次登录需输入正确密码';
      if (inviteWrap) inviteWrap.style.display = 'none';
      toggleAdminKeyField();
    }
  }

  function validateLoginForm() {
    const nameEl = document.getElementById('identity-name');
    const passwordEl = document.getElementById('identity-password');
    const confirmBtn = document.getElementById('identity-confirm');
    if (!nameEl || !passwordEl || !confirmBtn) return;
    const valid = nameEl.value.trim().length > 0 && passwordEl.value.length >= 1;
    confirmBtn.disabled = !valid;
  }

  async function handleAuth() {
    const nameEl = document.getElementById('identity-name');
    const passwordEl = document.getElementById('identity-password');
    const roleSelect = document.getElementById('identity-role');
    const adminKeyEl = document.getElementById('admin-key');
    const inviteCodeEl = document.getElementById('invite-code');
    const modal = document.getElementById('identity-modal');

    const name = nameEl.value.trim();
    const password = passwordEl.value;
    const role = roleSelect ? roleSelect.value : 'teacher';

    if (!name) { setError('请输入姓名'); return; }
    if (!password) { setError('请输入密码'); return; }

    // Check if user is banned (cloud check)
    if (window.StarEarthDB && window.StarEarthDB.isSupabaseReady()) {
      try {
        const banned = await window.StarEarthDB.isUserBanned(name);
        if (banned) {
          setError('🚫 您的账号已被管理员停用，请联系管理员');
          passwordEl.value = '';
          return;
        }
      } catch {}
    }

    const existingUser = findUser(name);

    if (existingUser) {
      const hash = await hashPassword(password);
      if (hash !== existingUser.passwordHash) {
        setError('❌ 密码错误，请重试');
        passwordEl.value = '';
        passwordEl.focus();
        return;
      }
      // Validate admin key if switching to admin
      if (role === 'admin' && existingUser.role !== 'admin') {
        const key = adminKeyEl ? adminKeyEl.value.trim() : '';
        if (key !== ADMIN_SECRET) {
          setError('❌ 切换管理员需要正确的管理员密钥');
          return;
        }
      }
      // Update role if changed
      if (role !== existingUser.role) {
        const users = getRegisteredUsers();
        const idx = users.findIndex(u => u.name === name);
        if (idx >= 0) { users[idx].role = role; saveRegisteredUsers(users); }
      }
      saveIdentity(name, role);
      modal.style.display = 'none';
      document.body.classList.remove('se-locked');
      autoFillName(name);
      updateNavUser(name);
      setError('');
    } else {
      // REGISTER
      if (password.length < 4) {
        setError('密码至少需要4个字符');
        return;
      }
      // Invite code validation
      const inviteCode = inviteCodeEl ? inviteCodeEl.value.trim() : '';
      if (window.StarEarthDB && window.StarEarthDB.isSupabaseReady()) {
        try {
          const correctCode = await window.StarEarthDB.getInviteCode();
          if (inviteCode !== correctCode) {
            setError('❌ 机构邀请码错误，请联系管理员获取');
            return;
          }
        } catch {}
      } else {
        // Offline fallback: use hardcoded default
        if (inviteCode !== 'xinyutu2026') {
          setError('❌ 机构邀请码错误，请联系管理员获取');
          return;
        }
      }
      // Admin key validation
      if (role === 'admin') {
        const key = adminKeyEl ? adminKeyEl.value.trim() : '';
        if (key !== ADMIN_SECRET) {
          setError('❌ 管理员密钥错误，请联系机构负责人获取');
          return;
        }
      }
      const hash = await hashPassword(password);
      const users = getRegisteredUsers();
      users.push({ name, role, passwordHash: hash, createdAt: new Date().toISOString() });
      saveRegisteredUsers(users);

      saveIdentity(name, role);
      modal.style.display = 'none';
      document.body.classList.remove('se-locked');
      autoFillName(name);
      updateNavUser(name);
      setError('');
    }
  }

  function showLoginModal() {
    const modal = document.getElementById('identity-modal');
    if (!modal) return;

    document.body.classList.add('se-locked');
    modal.style.display = 'flex';

    const nameInput = document.getElementById('identity-name');
    const passwordInput = document.getElementById('identity-password');
    const confirmBtn = document.getElementById('identity-confirm');
    const roleSelect = document.getElementById('identity-role');
    const adminKeyEl = document.getElementById('admin-key');

    if (nameInput) { nameInput.value = ''; nameInput.focus(); }
    if (passwordInput) passwordInput.value = '';
    if (adminKeyEl) adminKeyEl.value = '';
    if (roleSelect) roleSelect.parentElement.style.display = 'flex';
    const keyWrap = document.getElementById('admin-key-wrap');
    if (keyWrap) keyWrap.style.display = 'none';
    setError('');
    updateModalUI('');

    if (confirmBtn) {
      confirmBtn.disabled = true;
      const newBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
      newBtn.addEventListener('click', handleAuth);
    }

    if (nameInput) {
      nameInput.oninput = function() {
        validateLoginForm();
        updateModalUI(nameInput.value.trim());
        setError('');
      };
    }
    if (passwordInput) {
      passwordInput.oninput = function() {
        validateLoginForm();
        setError('');
      };
      passwordInput.onkeydown = function(e) {
        if (e.key === 'Enter' && !document.getElementById('identity-confirm').disabled) {
          handleAuth();
        }
      };
    }
    // Role change listener for admin key
    if (roleSelect) {
      roleSelect.onchange = function() {
        toggleAdminKeyField();
      };
    }
  }

  // ---- Personal Center Modal ----
  function injectProfileStyles() {
    if (document.getElementById('se-profile-styles')) return;
    const s = document.createElement('style');
    s.id = 'se-profile-styles';
    s.textContent = `
      .profile-overlay {
        position: fixed; inset: 0; z-index: 10001;
        background: rgba(0,0,0,0.55); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        animation: fadeIn 0.2s ease;
      }
      @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
      .profile-modal {
        background: var(--surface, #1e1e2e); border: 1px solid var(--border, #333);
        border-radius: 20px; width: 560px; max-width: 94vw; max-height: 88vh;
        overflow: hidden; display: flex; flex-direction: column;
        box-shadow: 0 24px 64px rgba(0,0,0,0.5);
        animation: slideUp 0.3s ease;
        font-family: var(--font-sans, 'Noto Sans SC', sans-serif);
      }
      .profile-modal-header {
        display: flex; align-items: center; gap: 14px; padding: 24px 24px 18px;
        border-bottom: 1px solid var(--border, #333);
      }
      .profile-modal-header .pm-avatar {
        width: 52px; height: 52px; border-radius: 50%;
        background: linear-gradient(135deg, #c5a44e, #8b7a3a);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.3rem; font-weight: 700; color: #fff; flex-shrink: 0;
      }
      .profile-modal-header .pm-name { font-size: 1.05rem; font-weight: 700; color: var(--text); }
      .pm-role { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 600; margin-top: 3px; }
      .pm-role-t { background: rgba(99,102,241,0.15); color: #818cf8; }
      .pm-role-o { background: rgba(245,158,11,0.15); color: #fbbf24; }
      .pm-role-a { background: rgba(239,68,68,0.15); color: #f87171; }
      .pm-close { margin-left: auto; background: none; border: none; color: var(--text-muted); font-size: 1.4rem; cursor: pointer; padding: 4px 8px; border-radius: 8px; }
      .pm-close:hover { background: var(--border); }
      .profile-modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
      .pm-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin-bottom: 20px; }
      .pm-stat { background: var(--bg, #141420); border-radius: 12px; padding: 12px; text-align: center; }
      .pm-stat-num { font-size: 1.3rem; font-weight: 900; font-family: var(--font-serif, serif); color: var(--accent-brand, #c5a44e); }
      .pm-stat-label { font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; }
      .pm-section-title { font-size: 0.85rem; font-weight: 700; color: var(--text); margin: 18px 0 10px; display: flex; align-items: center; gap: 6px; }
      .pm-card { background: var(--bg, #141420); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; margin-bottom: 10px; cursor: pointer; transition: border-color 0.2s; }
      .pm-card:hover { border-color: var(--accent-brand, #c5a44e); }
      .pm-card-header { display: flex; justify-content: space-between; align-items: center; }
      .pm-card-title { font-size: 0.88rem; font-weight: 700; color: var(--text); }
      .pm-card-arrow { font-size: 0.75rem; color: var(--text-muted); transition: transform 0.2s; }
      .pm-card.expanded .pm-card-arrow { transform: rotate(180deg); }
      .pm-card-meta { font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; }
      .pm-card-meta span { margin-right: 10px; }
      .pm-card-detail { display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
      .pm-card.expanded .pm-card-detail { display: block; }
      .pm-detail-row { font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.6; }
      .pm-detail-label { font-weight: 600; color: var(--text); margin-right: 6px; }
      .pm-attach { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; background: rgba(99,102,241,0.08); color: #818cf8; font-size: 0.72rem; margin: 3px 4px 3px 0; font-weight: 500; }
      .pm-review { background: var(--surface, #1e1e2e); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; margin-top: 8px; }
      .pm-review-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
      .pm-reviewer { font-size: 0.75rem; font-weight: 600; color: var(--accent-brand, #c5a44e); }
      .pm-review-date { font-size: 0.65rem; color: var(--text-muted); }
      .pm-scores { display: flex; gap: 6px; flex-wrap: wrap; margin: 4px 0; }
      .pm-score-tag { font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; }
      .pm-score-a { background: rgba(16,185,129,0.12); color: #10b981; }
      .pm-score-b { background: rgba(245,158,11,0.12); color: #f59e0b; }
      .pm-score-c { background: rgba(239,68,68,0.12); color: #ef4444; }
      .pm-review-comment { font-size: 0.78rem; color: var(--text-secondary); margin-top: 6px; line-height: 1.5; }
      .pm-empty { text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 16px 0; }
      .profile-modal-footer { padding: 14px 24px; border-top: 1px solid var(--border); display: flex; gap: 10px; }
      .pm-btn { flex: 1; padding: 10px; border: none; border-radius: 10px; font-size: 0.82rem; font-weight: 600; cursor: pointer; text-align: center; font-family: inherit; transition: opacity 0.2s; }
      .pm-btn:hover { opacity: 0.85; }
      .pm-btn-switch { background: rgba(99,102,241,0.12); color: #818cf8; }
      .pm-btn-logout { background: rgba(239,68,68,0.12); color: #ef4444; }
      .pm-ops-metric { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 0.82rem; }
      .pm-ops-metric:last-child { border-bottom: none; }
      .pm-ops-label { color: var(--text-secondary); }
      .pm-ops-value { font-weight: 700; color: var(--text); }
      .pm-ops-bar { height: 6px; border-radius: 3px; background: var(--border); margin-top: 6px; overflow: hidden; }
      .pm-ops-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
      @media (max-width: 560px) { .pm-stats { grid-template-columns: 1fr 1fr; } .profile-modal { max-width: 98vw; } }
    `;
    document.head.appendChild(s);
  }

  function esc(str) { if (!str) return ''; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  function showProfilePanel() {
    const existing = document.querySelector('.profile-overlay');
    if (existing) { existing.remove(); return; }

    const identity = getSavedIdentity();
    if (!identity) { showLoginModal(); return; }
    const user = findUser(identity.name);
    if (!user) { showLoginModal(); return; }

    injectProfileStyles();

    const roleMap = { admin: ['管理员', 'pm-role-a'], ops: ['运营', 'pm-role-o'], teacher: ['教师', 'pm-role-t'] };
    const [roleLabel, roleCls] = roleMap[identity.role] || roleMap.teacher;
    const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '—';

    let bodyHTML = '';
    if (identity.role === 'ops') {
      bodyHTML = buildOpsProfileBody(identity);
    } else {
      bodyHTML = buildTeacherProfileBody(identity);
      if (identity.role === 'admin') {
        bodyHTML += buildOpsProfileBody(identity, true);
      }
    }

    const overlay = document.createElement('div');
    overlay.className = 'profile-overlay';
    overlay.innerHTML = `
      <div class="profile-modal">
        <div class="profile-modal-header">
          <div class="pm-avatar">${identity.name.charAt(0)}</div>
          <div>
            <div class="pm-name">${esc(identity.name)}</div>
            <span class="pm-role ${roleCls}">${roleLabel}</span>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">加入于 ${joinDate}</div>
          </div>
          <button class="pm-close" id="pm-close-btn">✕</button>
        </div>
        <div class="profile-modal-body">${bodyHTML}</div>
        <div class="profile-modal-footer">
          <button class="pm-btn pm-btn-switch" id="pm-switch-btn">🔄 切换账号</button>
          <button class="pm-btn pm-btn-logout" id="pm-logout-btn">🚪 退出登录</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Expandable card click
    overlay.querySelectorAll('.pm-card[data-expandable]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('a') || e.target.closest('input') || e.target.closest('button')) return;
        card.classList.toggle('expanded');
      });
    });

    // KPI save button (admin only)
    const kpiSaveBtn = overlay.querySelector('#kpi-save-btn');
    if (kpiSaveBtn) {
      kpiSaveBtn.onclick = (e) => {
        e.stopPropagation();
        const targets = {
          inquiry: parseInt(overlay.querySelector('#kpi-inquiry')?.value) || 100,
          conversion: parseInt(overlay.querySelector('#kpi-conv')?.value) || 15,
          xhsEngageRate: parseFloat(overlay.querySelector('#kpi-xhs')?.value) || 5,
          wechatPosts: parseInt(overlay.querySelector('#kpi-wechat')?.value) || 20,
        };
        localStorage.setItem(KPI_KEY, JSON.stringify(targets));
        kpiSaveBtn.textContent = '✅ 已保存';
        kpiSaveBtn.style.background = '#10b981';
        setTimeout(() => { kpiSaveBtn.textContent = '💾 保存 KPI 目标'; kpiSaveBtn.style.background = ''; }, 1500);
      };
      // Prevent click on inputs from bubbling
      overlay.querySelectorAll('#kpi-inquiry,#kpi-conv,#kpi-xhs,#kpi-wechat').forEach(inp => {
        inp.addEventListener('click', e => e.stopPropagation());
      });
    }

    overlay.querySelector('#pm-close-btn').onclick = () => overlay.remove();
    overlay.querySelector('#pm-logout-btn').onclick = () => {
      overlay.remove(); clearIdentity(); updateNavUser(null); showLoginModal();
    };
    overlay.querySelector('#pm-switch-btn').onclick = () => {
      overlay.remove(); clearIdentity(); updateNavUser(null); showLoginModal();
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  // ---- Teacher / Admin Profile Body ----
  function buildTeacherProfileBody(identity) {
    const courses = JSON.parse(localStorage.getItem('se-courses') || '[]');
    const cases = JSON.parse(localStorage.getItem('se-pbl-cases') || '[]');
    const myCourses = courses.filter(c => c.teacher === identity.name);
    const myCases = cases.filter(c => c.teacher === identity.name);
    let totalReviews = 0;
    myCourses.forEach(c => { if (c.reviews) totalReviews += c.reviews.length; });
    const dimLabels = { d1: '教育目标', d2: 'PBL方法论', d3: '教育原则', d4: '年龄适配', d5: '教案完整' };

    let html = `<div class="pm-stats">
      <div class="pm-stat"><div class="pm-stat-num">${myCourses.length}</div><div class="pm-stat-label">我的课程</div></div>
      <div class="pm-stat"><div class="pm-stat-num">${myCases.length}</div><div class="pm-stat-label">我的案例</div></div>
      <div class="pm-stat"><div class="pm-stat-num">${totalReviews}</div><div class="pm-stat-label">收到评审</div></div>
    </div>`;

    // Courses
    html += '<div class="pm-section-title">📖 我的课程</div>';
    if (myCourses.length === 0) {
      html += '<div class="pm-empty">暂无提交的课程</div>';
    } else {
      myCourses.forEach(c => {
        // Course detail content
        let detailHTML = '';
        if (c.ability) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">🎯 能力目标：</span>${esc(c.ability)}</div>`;
        if (c.alignment) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">📐 课程对齐：</span>${esc(c.alignment)}</div>`;
        if (c.driving) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">🚗 驱动问题：</span>${esc(c.driving)}</div>`;
        if (c.knowledge) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">📚 知识构建：</span>${esc(c.knowledge)}</div>`;
        if (c.handson) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">🔧 动手实践：</span>${esc(c.handson)}</div>`;
        if (c.reflect) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">💡 反思延伸：</span>${esc(c.reflect)}</div>`;
        if (c.safety) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">⚠️ 安全提示：</span>${esc(c.safety)}</div>`;
        if (c.duration) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">⏱️ 时长：</span>${esc(c.duration)}</div>`;
        if (c.steps && c.steps.length > 0) {
          detailHTML += '<div class="pm-detail-row"><span class="pm-detail-label">📋 课程流程：</span>';
          c.steps.forEach((s, i) => { detailHTML += `<div style="margin-top:4px">Step ${i+1}: ${esc(s.duration)} — ${esc(s.content)}</div>`; });
          detailHTML += '</div>';
        }
        if (c.materials && c.materials.length > 0) {
          detailHTML += '<div class="pm-detail-row"><span class="pm-detail-label">🧰 材料清单：</span>';
          c.materials.forEach(m => { detailHTML += `<span class="pm-attach">📦 ${esc(m.name)}${m.qty ? ' × ' + esc(m.qty) : ''}</span>`; });
          detailHTML += '</div>';
        }

        // Reviews
        let reviewsHTML = '';
        if (c.reviews && c.reviews.length > 0) {
          c.reviews.forEach(r => {
            const scores = r.scores || {};
            const scoresHTML = Object.entries(dimLabels).map(([key, label]) => {
              const grade = scores[key] || '—';
              return grade !== '—' ? `<span class="pm-score-tag ${grade === 'A' ? 'pm-score-a' : grade === 'B' ? 'pm-score-b' : 'pm-score-c'}">${label}: ${grade}</span>` : '';
            }).filter(Boolean).join('');
            const comment = r.comment || r.feedback || '';
            const rDate = r.date ? new Date(r.date).toLocaleDateString('zh-CN') : '';
            reviewsHTML += `<div class="pm-review">
              <div class="pm-review-header">
                <span class="pm-reviewer">📝 ${esc(r.reviewer || '匿名评审')}</span>
                <span class="pm-review-date">${rDate}</span>
              </div>
              ${scoresHTML ? `<div class="pm-scores">${scoresHTML}</div>` : ''}
              ${comment ? `<div class="pm-review-comment">💬 ${esc(comment)}</div>` : ''}
            </div>`;
          });
        }

        if (!detailHTML && !reviewsHTML) detailHTML = '<div style="font-size:0.72rem;color:var(--text-muted)">暂无详细信息</div>';

        const submitDate = c.submittedAt ? new Date(c.submittedAt).toLocaleDateString('zh-CN') : '';
        html += `<div class="pm-card" data-expandable>
          <div class="pm-card-header">
            <div class="pm-card-title">📖 ${esc(c.name || c.title || '未命名课程')}</div>
            <span class="pm-card-arrow">▼</span>
          </div>
          <div class="pm-card-meta">
            <span>🏷️ ${esc(c.module || '未分类')}</span>
            <span>👶 ${esc(c.age || '')}</span>
            <span>⏱️ ${esc(c.duration || '')}</span>
            ${submitDate ? `<span>📅 ${submitDate}</span>` : ''}
          </div>
          <div class="pm-card-detail">
            ${detailHTML}
            ${reviewsHTML ? '<div style="margin-top:10px;font-size:0.8rem;font-weight:600;color:var(--text)">📋 评审记录</div>' + reviewsHTML : ''}
          </div>
        </div>`;
      });
    }

    // Cases
    html += '<div class="pm-section-title">📦 我的案例</div>';
    if (myCases.length === 0) {
      html += '<div class="pm-empty">暂无上传的案例</div>';
    } else {
      myCases.forEach(c => {
        const cDate = c.submittedAt ? new Date(c.submittedAt).toLocaleDateString('zh-CN') : '';
        const modLabel = (c.modules && c.modules.length > 0) ? c.modules.join(' / ') : '未分类';
        // Build detail content with correct field names
        let detailHTML = '';
        if (c.eq) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">❓ 驱动问题：</span>${esc(c.eq)}</div>`;
        if (c.background) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">📋 案例背景：</span>${esc(c.background)}</div>`;
        if (c.knowledge) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">📚 知识构建：</span>${esc(c.knowledge)}</div>`;
        if (c.design) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">🎨 方案设计：</span>${esc(c.design)}</div>`;
        if (c.handson) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">🔧 动手实践：</span>${esc(c.handson)}</div>`;
        if (c.reflect) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">💡 反思延伸：</span>${esc(c.reflect)}</div>`;
        if (c.highlights) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">✨ 亮点：</span>${esc(c.highlights)}</div>`;
        if (c.pitfalls) detailHTML += `<div class="pm-detail-row"><span class="pm-detail-label">⚠️ 踩坑记录：</span>${esc(c.pitfalls)}</div>`;
        // Attachments (pptFiles)
        const allFiles = c.pptFiles || (c.pptFile ? [c.pptFile] : []);
        if (allFiles.length > 0) {
          detailHTML += '<div class="pm-detail-row"><span class="pm-detail-label">📎 附件：</span><div style="margin-top:4px">';
          allFiles.forEach(att => {
            const name = att.name || '附件';
            detailHTML += `<span class="pm-attach">📄 ${esc(name)}</span>`;
          });
          detailHTML += '</div></div>';
        }
        // Comments
        if (c.comments && c.comments.length > 0) {
          detailHTML += '<div style="margin-top:10px;font-size:0.8rem;font-weight:600;color:var(--text)">💬 评论</div>';
          c.comments.forEach(cm => {
            const cmDate = cm.date ? new Date(cm.date).toLocaleDateString('zh-CN') : '';
            detailHTML += `<div class="pm-review">
              <div class="pm-review-header">
                <span class="pm-reviewer">💬 ${esc(cm.author || '匿名')}</span>
                <span class="pm-review-date">${cmDate}</span>
              </div>
              <div class="pm-review-comment">${esc(cm.text || cm.content || '')}</div>
            </div>`;
          });
        }
        if (!detailHTML) detailHTML = '<div style="font-size:0.78rem;color:var(--text-muted)">暂无详细信息</div>';

        html += `<div class="pm-card" data-expandable>
          <div class="pm-card-header">
            <div class="pm-card-title">📦 ${esc(c.title || '未命名案例')}</div>
            <span class="pm-card-arrow">▼</span>
          </div>
          <div class="pm-card-meta">
            <span>🏷️ ${esc(modLabel)}</span>
            <span>👶 ${esc(c.age || '')}</span>
            ${cDate ? `<span>📅 ${cDate}</span>` : ''}
            ${c.likes ? `<span>❤️ ${c.likes}</span>` : ''}
          </div>
          <div class="pm-card-detail">${detailHTML}</div>
        </div>`;
      });
    }
    return html;
  }

  // ---- KPI Targets (stored in localStorage) ----
  const KPI_KEY = 'se-kpi-targets';
  function getKpiTargets() {
    try { return JSON.parse(localStorage.getItem(KPI_KEY) || 'null') || {}; } catch { return {}; }
  }
  function getKpi(key, fallback) { return getKpiTargets()[key] || fallback; }

  // ---- Ops Profile Body ----
  function buildOpsProfileBody(identity, isAdmin) {
    const OPS_KEY = 'se-ops-data';
    let allData = {};
    try { allData = JSON.parse(localStorage.getItem(OPS_KEY) || '{}'); } catch {}
    const now = new Date();
    const curMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const cur = allData[curMonth] || {};
    const months = Object.keys(allData).sort();
    const totalMonths = months.length;

    const inquiries = cur.inquiries || 0;
    const visits = cur.visits || 0;
    const signups = cur.signups || 0;
    const revenue = cur.revenue || 0;
    const target = cur.target || 0;
    const xhsViews = cur.xhsViews || 0;
    const xhsEngage = cur.xhsEngage || 0;
    const wechatPosts = cur.wechatPosts || 0;
    const dpReviews = cur.dpReviews || 0;

    // Configurable KPI targets
    const kpiInquiry = getKpi('inquiry', 100);
    const kpiConv = getKpi('conversion', 15);
    const kpiXhs = getKpi('xhsEngageRate', 5);
    const kpiWechat = getKpi('wechatPosts', 20);

    const convRate = inquiries > 0 ? (signups / inquiries * 100).toFixed(1) : '0.0';
    const revPct = target > 0 ? Math.min(100, Math.round(revenue / target * 100)) : 0;
    const xhsRate = xhsViews > 0 ? (xhsEngage / xhsViews * 100).toFixed(1) : '0.0';

    // Cumulative stats
    let totalRev = 0, totalSignups = 0;
    months.forEach(m => { totalRev += (allData[m]?.revenue || 0); totalSignups += (allData[m]?.signups || 0); });

    const sectionPrefix = isAdmin ? '<div class="pm-section-title">🚀 运营数据概览</div>' : '';

    let html = sectionPrefix + `<div class="pm-stats">
      <div class="pm-stat"><div class="pm-stat-num">${inquiries}</div><div class="pm-stat-label">本月咨询</div></div>
      <div class="pm-stat"><div class="pm-stat-num">${signups}</div><div class="pm-stat-label">本月报名</div></div>
      <div class="pm-stat"><div class="pm-stat-num">${convRate}%</div><div class="pm-stat-label">转化率</div></div>
      <div class="pm-stat"><div class="pm-stat-num">${revPct}%</div><div class="pm-stat-label">营收达成</div></div>
    </div>`;

    // Current month metrics
    html += '<div class="pm-section-title">📊 本月运营指标</div>';
    html += '<div class="pm-card">';
    const metrics = [
      ['📞 咨询量', `${inquiries} 人`],
      ['👀 到访量', `${visits} 人`],
      ['📝 报名人数', `${signups} 人`],
      ['💰 营收', `¥${revenue.toLocaleString()}`],
      ['🎯 营收目标', `¥${target.toLocaleString()}`],
      ['📕 小红书曝光', `${xhsViews.toLocaleString()} 次`],
      ['📕 小红书互动率', `${xhsRate}%`],
      ['💬 朋友圈发布', `${wechatPosts} 条`],
      ['⭐ 点评好评', `${dpReviews} 条`],
    ];
    metrics.forEach(([label, value]) => {
      html += `<div class="pm-ops-metric"><span class="pm-ops-label">${label}</span><span class="pm-ops-value">${value}</span></div>`;
    });
    html += '</div>';

    // KPI progress (using configurable targets)
    html += '<div class="pm-section-title">🎯 KPI 进度</div><div class="pm-card">';
    const kpis = [
      { label: `咨询目标 (${kpiInquiry}人)`, pct: Math.min(100, Math.round(inquiries / kpiInquiry * 100)), color: '#6366f1' },
      { label: `转化率目标 (${kpiConv}%)`, pct: Math.min(100, Math.round(parseFloat(convRate) / kpiConv * 100)), color: '#10b981' },
      { label: '营收达成', pct: revPct, color: '#f59e0b' },
      { label: `小红书互动率 (${kpiXhs}%)`, pct: Math.min(100, Math.round(parseFloat(xhsRate) / kpiXhs * 100)), color: '#ec4899' },
    ];
    kpis.forEach(k => {
      html += `<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-secondary)">
          <span>${k.label}</span><span style="font-weight:700;color:var(--text)">${k.pct}%</span>
        </div>
        <div class="pm-ops-bar"><div class="pm-ops-fill" style="width:${k.pct}%;background:${k.color}"></div></div>
      </div>`;
    });
    html += '</div>';

    // Admin KPI settings
    if (identity.role === 'admin') {
      html += '<div class="pm-section-title">⚙️ KPI 目标设置 <span style="font-size:0.7rem;font-weight:400;color:var(--text-muted)">（仅管理员可修改）</span></div>';
      html += `<div class="pm-card" style="cursor:default">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:4px">📞 月咨询目标(人)</label>
            <input type="number" id="kpi-inquiry" value="${kpiInquiry}" style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:0.82rem;font-family:inherit">
          </div>
          <div>
            <label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:4px">📈 转化率目标(%)</label>
            <input type="number" id="kpi-conv" value="${kpiConv}" style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:0.82rem;font-family:inherit">
          </div>
          <div>
            <label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:4px">📕 小红书互动率目标(%)</label>
            <input type="number" id="kpi-xhs" value="${kpiXhs}" step="0.5" style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:0.82rem;font-family:inherit">
          </div>
          <div>
            <label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:4px">💬 朋友圈发布目标(条)</label>
            <input type="number" id="kpi-wechat" value="${kpiWechat}" style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:0.82rem;font-family:inherit">
          </div>
        </div>
        <button id="kpi-save-btn" style="margin-top:12px;width:100%;padding:8px;border:none;border-radius:8px;background:var(--accent-brand,#c5a44e);color:#fff;font-weight:600;font-size:0.82rem;cursor:pointer;font-family:inherit">💾 保存 KPI 目标</button>
      </div>`;
    }

    // Cumulative
    if (totalMonths > 0) {
      html += '<div class="pm-section-title">📈 累计数据</div>';
      html += `<div class="pm-card">
        <div class="pm-ops-metric"><span class="pm-ops-label">📅 已记录月份</span><span class="pm-ops-value">${totalMonths} 个月</span></div>
        <div class="pm-ops-metric"><span class="pm-ops-label">💰 累计营收</span><span class="pm-ops-value">¥${totalRev.toLocaleString()}</span></div>
        <div class="pm-ops-metric"><span class="pm-ops-label">📝 累计报名</span><span class="pm-ops-value">${totalSignups} 人</span></div>
      </div>`;
    }

    return html;
  }

  // Replace old __switchUser with profile panel toggle
  window.__showProfile = showProfilePanel;
  window.__switchUser = function() {
    clearIdentity();
    updateNavUser(null);
    showLoginModal();
  };

  function initMobileMenu() {
    const header = document.querySelector('.page-header');
    if (!header) return;

    const navLinks = header.querySelector('.nav-links');
    if (!navLinks) return;

    // Check if menu-toggle button already exists
    let toggleBtn = header.querySelector('.menu-toggle');
    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.className = 'menu-toggle';
      toggleBtn.setAttribute('aria-label', 'Toggle Navigation Menu');
      toggleBtn.innerHTML = '<span></span><span></span><span></span>';
      
      // Insert hamburger button in header
      header.insertBefore(toggleBtn, navLinks);
    }

    // Toggle drawer on hamburger click
    toggleBtn.onclick = function(e) {
      e.stopPropagation();
      toggleBtn.classList.toggle('active');
      navLinks.classList.toggle('active');
    };

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!header.contains(e.target)) {
        toggleBtn.classList.remove('active');
        navLinks.classList.remove('active');
      }
    });

    // Handle dropdown triggers on mobile click
    const groupTriggers = navLinks.querySelectorAll('.nav-group-trigger');
    groupTriggers.forEach(function(trigger) {
      trigger.addEventListener('click', function(e) {
        if (window.innerWidth <= 900) {
          const group = trigger.closest('.nav-group');
          if (group) {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle active state for this dropdown, close others
            navLinks.querySelectorAll('.nav-group').forEach(function(g) {
              if (g !== group) g.classList.remove('active');
            });
            group.classList.toggle('active');
          }
        }
      });
    });
  }

  function initIdentity() {
    // Initialize mobile responsive menu
    try { initMobileMenu(); } catch (e) { console.warn('Mobile menu init failed:', e); }

    // 一次性自动修复：如果当前登录的是 张居琪2 且被误降级了，自动恢复管理员身份并同步至云端
    const savedIdentity = getSavedIdentity();
    if (savedIdentity && savedIdentity.name === '张居琪2' && savedIdentity.role !== 'admin') {
      savedIdentity.role = 'admin';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedIdentity));
      const localUsers = getRegisteredUsers();
      const idx = localUsers.findIndex(u => u.name === '张居琪2');
      if (idx >= 0) {
        localUsers[idx].role = 'admin';
        localStorage.setItem(USERS_KEY, JSON.stringify(localUsers));
      }
      if (window.StarEarthDB && window.StarEarthDB.isSupabaseReady()) {
        window.StarEarthDB.updateUserRole('张居琪2', 'admin').catch(() => {});
      }
    }

    // Rebind nav button to show profile instead of re-login
    const navBtn = document.getElementById('nav-user-btn');
    if (navBtn) {
      navBtn.setAttribute('onclick', 'window.__showProfile && window.__showProfile()');
    }

    const identity = getSavedIdentity();
    if (identity) {
      const user = findUser(identity.name);
      if (user) {
        // Sync role from user registry to session
        if (identity.role !== user.role) {
          saveIdentity(identity.name, user.role);
        }
        document.body.classList.remove('se-locked');
        autoFillName(identity.name);
        updateNavUser(identity.name);
        return;
      }
      clearIdentity();
    }
    // Not logged in — lock the page and show modal
    document.body.classList.add('se-locked');
    updateNavUser(null);
    showLoginModal();
  }

  function autoFillName(name) {
    const teacherField = document.getElementById('f-teacher');
    if (teacherField && !teacherField.value) {
      teacherField.value = name;
      teacherField.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const topicTeacher = document.getElementById('t-teacher');
    if (topicTeacher && !topicTeacher.value) {
      topicTeacher.value = name;
      topicTeacher.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const caseTeacher = document.getElementById('c-teacher');
    if (caseTeacher && !caseTeacher.value) {
      caseTeacher.value = name;
      caseTeacher.dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.querySelectorAll('.review-name').forEach(input => {
      if (!input.value) input.value = name;
    });
  }

  window.StarEarthIdentity = {
    getSavedIdentity,
    saveIdentity,
    clearIdentity,
    initIdentity,
    autoFillName,
    updateNavUser,
    getRegisteredUsers,
    findUser,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIdentity);
  } else {
    setTimeout(initIdentity, 100);
  }
})();

