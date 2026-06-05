/**
 * StarEarth — Supabase 数据访问层
 * 封装所有与 Supabase 的交互，前端只需调用这里的函数
 *
 * 使用方式：
 * 1. 在 Supabase Dashboard 获取 Project URL 和 anon key
 * 2. 填入下方 SUPABASE_URL 和 SUPABASE_ANON_KEY
 * 3. 在 HTML 中引入：<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 * 4. 再引入本文件：<script src="supabase-client.js"></script>
 */

// ============================================================
// 配置 —— 上线前替换为真实值
// ============================================================
const SUPABASE_URL = 'https://hyqdeepnodhjytyhdrcu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cWRlZXBub2Roanl0eWhkcmN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzk0NzAsImV4cCI6MjA5MjkxNTQ3MH0.jZoA9rgbSbCEb0N3Wqu7hMW-nMydnWDK2Ir_IfNw9dY';

// 初始化 Supabase 客户端（延迟初始化）
// 注意：SDK 的 UMD 包会在全局创建 window.supabase，此处用 _sbClient 避免命名冲突
let _sbClient = null;
let _hasTriggeredSync = false;

function _ensureSupabase() {
  if (_sbClient) return _sbClient;
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      _sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ Supabase 客户端初始化成功');
      if (!_hasTriggeredSync) {
        _hasTriggeredSync = true;
        setTimeout(syncLocalStorageToCloud, 1000);
      }
    } catch (e) {
      console.warn('⚠️ Supabase 初始化失败:', e);
      _sbClient = null;
    }
  }
  return _sbClient;
}

/**
 * 检查 Supabase 是否可用，不可用时降级为 localStorage
 */
function isSupabaseReady() {
  _ensureSupabase();
  return _sbClient !== null;
}

// ============================================================
// 用户 (Users)
// ============================================================

/**
 * 获取或创建用户（简易模式，通过姓名查找）
 * 正式上线后应改为 Supabase Auth 登录
 */
async function getOrCreateUser(name, role = 'teacher') {
  if (!isSupabaseReady()) return { id: 'local_' + name, name, role };

  // 先查找是否已存在
  const { data: existing } = await _sbClient
    .from('users')
    .select('*')
    .eq('name', name)
    .single();

  if (existing) return existing;

  // 不存在则创建
  const { data, error } = await _sbClient
    .from('users')
    .insert({ name, role })
    .select()
    .single();

  if (error) throw new Error('创建用户失败: ' + error.message);
  return data;
}

// ============================================================
// 课程 (Courses)
// ============================================================

/**
 * 提交新课程
 * @param {Object} courseData - 课程表单数据
 * @returns {Object} 创建的课程记录
 */
async function createCourse(courseData) {
  if (!isSupabaseReady()) {
    return _localCreateCourse(courseData);
  }

  // 先获取/创建教师用户
  const teacher = await getOrCreateUser(courseData.teacher, 'teacher');

  // 插入课程主记录
  const { data: course, error } = await _sbClient
    .from('courses')
    .insert({
      teacher_id:       teacher.id,
      name:             courseData.name,
      module:           courseData.module,
      age_group:        courseData.age,
      course_type:      courseData.type,
      duration:         courseData.duration,
      ability:          courseData.ability,
      alignment:        courseData.alignment,
      diff_from_school: courseData.diff,
      driving_question: courseData.driving,
      is_dual_track:    courseData.dualTrack || false,
      // 双线字段
      steam_knowledge:  courseData.steamKnowledge || null,
      steam_handson:    courseData.steamHandson || null,
      steam_solution:   courseData.steamSolution || null,
      hum_inquiry:      courseData.humInquiry || null,
      hum_discussion:   courseData.humDiscussion || null,
      hum_resource:     courseData.humResource || null,
      convergence:      courseData.convergence || null,
      // 单线字段
      knowledge:        courseData.knowledge || null,
      solution:         courseData.solution || null,
      handson:          courseData.handson || null,
      // 共用字段
      reflect:          courseData.reflect,
      materials:        courseData.materials,
      safety:           courseData.safety || null,
    })
    .select()
    .single();

  if (error) throw new Error('提交课程失败: ' + error.message);

  // 插入教学流程步骤
  if (courseData.steps && courseData.steps.length > 0) {
    const steps = courseData.steps.map((step, i) => ({
      course_id:  course.id,
      sort_order: i + 1,
      duration:   step.duration,
      content:    step.content,
    }));

    const { error: stepsError } = await _sbClient
      .from('course_steps')
      .insert(steps);

    if (stepsError) console.error('插入步骤失败:', stepsError.message);
  }

  return course;
}

/**
 * 获取所有课程（含评审统计）
 * @param {Object} filters - 可选筛选条件 { module, ageGroup, status }
 * @returns {Array} 课程列表
 */
async function getCourses(filters = {}) {
  if (!isSupabaseReady()) {
    return _localGetCourses();
  }

  let query = _sbClient
    .from('courses')
    .select(`
      *,
      teacher:users!teacher_id ( id, name ),
      steps:course_steps ( id, sort_order, duration, content ),
      reviews (
        id,
        reviewer:users!reviewer_id ( id, name ),
        comment,
        created_at,
        scores:review_scores ( dimension_key, grade )
      )
    `)
    .order('submitted_at', { ascending: false });

  // 应用筛选
  if (filters.module)   query = query.eq('module', filters.module);
  if (filters.ageGroup) query = query.eq('age_group', filters.ageGroup);
  if (filters.status)   query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw new Error('获取课程列表失败: ' + error.message);

  // 步骤排序
  data.forEach(course => {
    if (course.steps) {
      course.steps.sort((a, b) => a.sort_order - b.sort_order);
    }
  });

  return data;
}

/**
 * 获取单个课程详情
 * @param {string} courseId - 课程 UUID
 * @returns {Object} 课程详情
 */
async function getCourse(courseId) {
  if (!isSupabaseReady()) {
    return _localGetCourses().find(c => c.id === courseId) || null;
  }

  const { data, error } = await _sbClient
    .from('courses')
    .select(`
      *,
      teacher:users!teacher_id ( id, name ),
      steps:course_steps ( id, sort_order, duration, content ),
      reviews (
        id,
        reviewer:users!reviewer_id ( id, name ),
        comment,
        created_at,
        scores:review_scores ( dimension_key, grade )
      )
    `)
    .eq('id', courseId)
    .single();

  if (error) throw new Error('获取课程失败: ' + error.message);

  if (data.steps) {
    data.steps.sort((a, b) => a.sort_order - b.sort_order);
  }

  return data;
}


// ============================================================
// 评审 (Reviews)
// ============================================================

/**
 * 提交课程评审
 * @param {string} courseId - 课程 UUID
 * @param {Object} reviewData - { reviewer, scores: {d1:'A', d2:'B',...}, comment }
 * @returns {Object} 创建的评审记录
 */
async function createReview(courseId, reviewData) {
  if (!isSupabaseReady()) {
    return _localCreateReview(courseId, reviewData);
  }

  // 获取/创建评审人
  const reviewer = await getOrCreateUser(reviewData.reviewer, 'reviewer');

  // 插入评审主记录
  const { data: review, error } = await _sbClient
    .from('reviews')
    .insert({
      course_id:   courseId,
      reviewer_id: reviewer.id,
      comment:     reviewData.comment || null,
    })
    .select()
    .single();

  if (error) throw new Error('提交评审失败: ' + error.message);

  // 插入各维度得分
  const scores = Object.entries(reviewData.scores).map(([dimKey, grade]) => ({
    review_id:     review.id,
    dimension_key: dimKey,
    grade:         grade,
  }));

  const { error: scoresError } = await _sbClient
    .from('review_scores')
    .insert(scores);

  if (scoresError) throw new Error('保存评分失败: ' + scoresError.message);

  // 自动更新课程状态（简易逻辑）
  await _updateCourseStatus(courseId);

  return review;
}

/**
 * 获取课程的评审汇总
 * @param {string} courseId - 课程 UUID
 */
async function getReviewSummary(courseId) {
  if (!isSupabaseReady()) return null;

  const { data, error } = await _sbClient
    .from('course_review_summary')
    .select('*')
    .eq('course_id', courseId)
    .single();

  if (error) return null;
  return data;
}


// ============================================================
// 删除课程 (Delete Course)
// ============================================================

/**
 * 删除课程及其所有关联数据（步骤、评审、评分）
 * @param {string} courseId - 课程 ID
 */
async function deleteCourse(courseId) {
  if (!isSupabaseReady()) {
    return _localDeleteCourse(courseId);
  }

  // Supabase 的外键设置了 ON DELETE CASCADE，删除课程会自动删除步骤、评审和评分
  const { error } = await _sbClient
    .from('courses')
    .delete()
    .eq('id', courseId);

  if (error) throw new Error('删除课程失败: ' + error.message);
}


// ============================================================
// 更新课程 (Update Course)
// ============================================================

/**
 * 更新已有课程
 * @param {string} courseId - 课程 ID
 * @param {Object} courseData - 更新的课程数据
 * @returns {Object} 更新后的课程记录
 */
async function updateCourse(courseId, courseData) {
  if (!isSupabaseReady()) {
    return _localUpdateCourse(courseId, courseData);
  }

  // 更新课程主记录
  const { data: course, error } = await _sbClient
    .from('courses')
    .update({
      name:             courseData.name,
      module:           courseData.module,
      age_group:        courseData.age,
      course_type:      courseData.type,
      duration:         courseData.duration,
      ability:          courseData.ability,
      alignment:        courseData.alignment,
      diff_from_school: courseData.diff,
      driving_question: courseData.driving,
      is_dual_track:    courseData.dualTrack || false,
      steam_knowledge:  courseData.steamKnowledge || null,
      steam_handson:    courseData.steamHandson || null,
      steam_solution:   courseData.steamSolution || null,
      hum_inquiry:      courseData.humInquiry || null,
      hum_discussion:   courseData.humDiscussion || null,
      hum_resource:     courseData.humResource || null,
      convergence:      courseData.convergence || null,
      knowledge:        courseData.knowledge || null,
      solution:         courseData.solution || null,
      handson:          courseData.handson || null,
      reflect:          courseData.reflect,
      materials:        courseData.materials,
      safety:           courseData.safety || null,
    })
    .eq('id', courseId)
    .select()
    .single();

  if (error) throw new Error('更新课程失败: ' + error.message);

  // 更新步骤：先删除旧步骤，再插入新步骤
  await _sbClient.from('course_steps').delete().eq('course_id', courseId);

  if (courseData.steps && courseData.steps.length > 0) {
    const steps = courseData.steps.map((step, i) => ({
      course_id:  courseId,
      sort_order: i + 1,
      duration:   step.duration,
      content:    step.content,
    }));
    await _sbClient.from('course_steps').insert(steps);
  }

  return course;
}


// ============================================================
// 评审维度 (Review Dimensions)
// ============================================================

/**
 * 获取评审维度配置
 * @returns {Array} 维度列表
 */
async function getReviewDimensions() {
  if (!isSupabaseReady()) {
    // 返回硬编码默认值
    return [
      { key: 'd1', label: '教育目标对齐度',       weight: 0.25, sort_order: 1 },
      { key: 'd2', label: 'PBL方法论落实度',      weight: 0.25, sort_order: 2 },
      { key: 'd3', label: '教育过程原则践行度',    weight: 0.25, sort_order: 3 },
      { key: 'd4', label: '年龄适配度与内容质量',  weight: 0.15, sort_order: 4 },
      { key: 'd5', label: '教案完整性与可操作性',  weight: 0.10, sort_order: 5 },
    ];
  }

  const { data, error } = await _sbClient
    .from('review_dimensions')
    .select('*')
    .order('sort_order');

  if (error) throw new Error('获取评审维度失败: ' + error.message);
  return data;
}


// ============================================================
// 内部：自动更新课程状态
// ============================================================
async function _updateCourseStatus(courseId) {
  const summary = await getReviewSummary(courseId);
  if (!summary || summary.review_count === 0) return;

  // 与前端逻辑保持一致
  const dims = [summary.d1_avg, summary.d2_avg, summary.d3_avg, summary.d4_avg, summary.d5_avg];
  const allB = dims.every(s => s >= 2);
  const topThreeA = dims.slice(0, 3).filter(s => s >= 2.5).length >= 2;
  const anyFail = dims.slice(0, 3).some(s => s < 1.5);

  let status;
  if (anyFail) status = 'rejected';
  else if (allB && topThreeA) status = 'passed';
  else status = 'needs_revision';

  await _sbClient
    .from('courses')
    .update({ status })
    .eq('id', courseId);
}


// ============================================================
// localStorage 降级方案（Supabase 不可用时）
// 保持与旧版完全兼容
// ============================================================

function _localGetCourses() {
  return JSON.parse(localStorage.getItem('se-courses') || '[]');
}

function _localSaveCourses(courses) {
  localStorage.setItem('se-courses', JSON.stringify(courses));
}

function _localCreateCourse(courseData) {
  const course = {
    id: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    ...courseData,
    submittedAt: new Date().toISOString(),
    reviews: [],
  };
  const courses = _localGetCourses();
  courses.push(course);
  _localSaveCourses(courses);
  return course;
}

function _localCreateReview(courseId, reviewData) {
  const courses = _localGetCourses();
  const courseIndex = courses.findIndex(c => c.id === courseId);
  if (courseIndex === -1) throw new Error('课程不存在');

  if (!courses[courseIndex].reviews) courses[courseIndex].reviews = [];
  const review = {
    reviewer: reviewData.reviewer,
    scores: reviewData.scores,
    comment: reviewData.comment,
    date: new Date().toISOString(),
  };
  courses[courseIndex].reviews.push(review);
  _localSaveCourses(courses);
  return review;
}

function _localDeleteCourse(courseId) {
  const courses = _localGetCourses();
  const filtered = courses.filter(c => c.id !== courseId);
  _localSaveCourses(filtered);
}

function _localUpdateCourse(courseId, courseData) {
  const courses = _localGetCourses();
  const index = courses.findIndex(c => c.id === courseId);
  if (index === -1) throw new Error('课程不存在');

  // Preserve reviews, id, and submittedAt
  courses[index] = {
    ...courses[index],
    ...courseData,
    id: courseId,
    submittedAt: courses[index].submittedAt,
    reviews: courses[index].reviews || [],
  };
  _localSaveCourses(courses);
  return courses[index];
}


// ============================================================
// PBL 案例 (pbl_cases)
// ============================================================

async function getCases() {
  if (!isSupabaseReady()) return JSON.parse(localStorage.getItem('se-pbl-cases') || '[]');
  try {
    const { data, error } = await _sbClient
      .from('pbl_cases')
      .select('*')
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    // Map DB columns to frontend format
    const cases = (data || []).map(c => ({
      id: c.id,
      title: c.title,
      teacher: c.teacher,
      age: c.age,
      type: c.type,
      modules: c.modules || [],
      eq: c.eq,
      knowledge: c.knowledge,
      design: c.design,
      handson: c.handson,
      reflect: c.reflect,
      background: c.background,
      highlights: c.highlights,
      pitfalls: c.pitfalls,
      pptFiles: c.ppt_files || [],
      comments: c.comments || [],
      likes: c.likes || 0,
      submittedAt: c.submitted_at,
    }));
    // Cache locally
    localStorage.setItem('se-pbl-cases', JSON.stringify(cases));
    return cases;
  } catch (err) {
    console.warn('⚠️ Supabase getCases failed, using localStorage:', err.message);
    return JSON.parse(localStorage.getItem('se-pbl-cases') || '[]');
  }
}

async function saveCase(caseData) {
  // Save to localStorage first (instant)
  const localCases = JSON.parse(localStorage.getItem('se-pbl-cases') || '[]');
  const idx = localCases.findIndex(c => c.id === caseData.id);
  if (idx >= 0) localCases[idx] = caseData;
  else localCases.push(caseData);
  localStorage.setItem('se-pbl-cases', JSON.stringify(localCases));

  if (!isSupabaseReady()) return caseData;
  try {
    const row = {
      id: caseData.id,
      title: caseData.title,
      teacher: caseData.teacher,
      age: caseData.age,
      type: caseData.type,
      modules: caseData.modules || [],
      eq: caseData.eq,
      knowledge: caseData.knowledge,
      design: caseData.design,
      handson: caseData.handson,
      reflect: caseData.reflect,
      background: caseData.background,
      highlights: caseData.highlights,
      pitfalls: caseData.pitfalls,
      ppt_files: caseData.pptFiles || [],
      comments: caseData.comments || [],
      likes: caseData.likes || 0,
      submitted_at: caseData.submittedAt || new Date().toISOString(),
    };
    await _sbClient.from('pbl_cases').upsert(row, { onConflict: 'id' });
  } catch (err) {
    console.warn('⚠️ Supabase saveCase failed:', err.message);
  }
  return caseData;
}

async function saveCases(cases) {
  localStorage.setItem('se-pbl-cases', JSON.stringify(cases));
  if (!isSupabaseReady()) return;
  try {
    // Bulk upsert
    const rows = cases.map(c => ({
      id: c.id, title: c.title, teacher: c.teacher, age: c.age, type: c.type,
      modules: c.modules || [], eq: c.eq, knowledge: c.knowledge,
      design: c.design, handson: c.handson, reflect: c.reflect,
      background: c.background, highlights: c.highlights, pitfalls: c.pitfalls,
      ppt_files: c.pptFiles || [], comments: c.comments || [],
      likes: c.likes || 0, submitted_at: c.submittedAt || new Date().toISOString(),
    }));
    // Delete all and reinsert (simplest for full sync)
    await _sbClient.from('pbl_cases').delete().neq('id', '___never___');
    if (rows.length > 0) await _sbClient.from('pbl_cases').insert(rows);
  } catch (err) {
    console.warn('⚠️ Supabase saveCases failed:', err.message);
  }
}

async function deleteCase(caseId) {
  const localCases = JSON.parse(localStorage.getItem('se-pbl-cases') || '[]');
  localStorage.setItem('se-pbl-cases', JSON.stringify(localCases.filter(c => c.id !== caseId)));
  if (!isSupabaseReady()) return;
  try {
    await _sbClient.from('pbl_cases').delete().eq('id', caseId);
  } catch (err) {
    console.warn('⚠️ Supabase deleteCase failed:', err.message);
  }
}


// ============================================================
// 选题 (Topics)
// ============================================================

async function getTopics() {
  if (!isSupabaseReady()) return JSON.parse(localStorage.getItem('se-topics') || '[]');
  try {
    const { data, error } = await _sbClient
      .from('topics')
      .select('*')
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    const topics = (data || []).map(t => {
      // If full_data exists, use it (has all fields)
      if (t.full_data && typeof t.full_data === 'object') {
        return { ...t.full_data, id: t.id, submittedAt: t.submitted_at };
      }
      // Fallback to individual columns (legacy)
      return {
        id: t.id, title: t.title, teacher: t.teacher, module: t.module,
        modules: [t.module].filter(Boolean),
        age: t.age, type: t.type, eq: t.eq, outline: t.outline,
        driving: t.eq, inspiration: '', abilities: [], diff: '',
        selfChecks: {}, selfCheckPass: 0, selfCheckTotal: 8,
        status: t.status, reviews: t.reviews || [], submittedAt: t.submitted_at,
      };
    });
    localStorage.setItem('se-topics', JSON.stringify(topics));
    return topics;
  } catch (err) {
    console.warn('⚠️ Supabase getTopics failed:', err.message);
    return JSON.parse(localStorage.getItem('se-topics') || '[]');
  }
}

async function saveTopics(topics) {
  localStorage.setItem('se-topics', JSON.stringify(topics));
  if (!isSupabaseReady()) return;
  try {
    const rows = topics.map(t => ({
      id: t.id, title: t.title || '', teacher: t.teacher || '',
      module: (t.modules && t.modules[0]) || t.module || '',
      age: t.age || '', type: t.type || '',
      eq: t.driving || t.eq || '', outline: t.outline || '',
      status: t.status || 'pending', reviews: t.reviews || [],
      full_data: t,
      submitted_at: t.submittedAt || new Date().toISOString(),
    }));
    await _sbClient.from('topics').delete().neq('id', '___never___');
    if (rows.length > 0) await _sbClient.from('topics').insert(rows);
  } catch (err) {
    console.warn('⚠️ Supabase saveTopics failed:', err.message);
  }
}

async function saveTopic(topic) {
  const localTopics = JSON.parse(localStorage.getItem('se-topics') || '[]');
  const idx = localTopics.findIndex(t => t.id === topic.id);
  if (idx >= 0) localTopics[idx] = topic; else localTopics.push(topic);
  localStorage.setItem('se-topics', JSON.stringify(localTopics));
  if (!isSupabaseReady()) return;
  try {
    const row = {
      id: topic.id, title: topic.title || '', teacher: topic.teacher || '',
      module: (topic.modules && topic.modules[0]) || topic.module || '',
      age: topic.age || '', type: topic.type || '',
      eq: topic.driving || topic.eq || '', outline: topic.outline || '',
      status: topic.status || 'pending', reviews: topic.reviews || [],
      full_data: topic,
      submitted_at: topic.submittedAt || new Date().toISOString(),
    };
    await _sbClient.from('topics').upsert(row, { onConflict: 'id' });
  } catch (err) {
    console.warn('⚠️ Supabase saveTopic failed:', err.message);
  }
}

async function deleteTopic(topicId) {
  const localTopics = JSON.parse(localStorage.getItem('se-topics') || '[]');
  localStorage.setItem('se-topics', JSON.stringify(localTopics.filter(t => t.id !== topicId)));
  if (!isSupabaseReady()) return;
  try {
    await _sbClient.from('topics').delete().eq('id', topicId);
  } catch (err) {
    console.warn('⚠️ Supabase deleteTopic failed:', err.message);
  }
}


// ============================================================
// 运营数据 (Ops Data)
// ============================================================

async function getOpsData() {
  if (!isSupabaseReady()) {
    try { return JSON.parse(localStorage.getItem('se-ops-data') || '{}'); } catch { return {}; }
  }
  try {
    const { data, error } = await _sbClient.from('ops_data').select('*');
    if (error) throw error;
    const result = {};
    (data || []).forEach(r => { result[r.month] = r.data; });
    localStorage.setItem('se-ops-data', JSON.stringify(result));
    return result;
  } catch (err) {
    console.warn('⚠️ Supabase getOpsData failed:', err.message);
    try { return JSON.parse(localStorage.getItem('se-ops-data') || '{}'); } catch { return {}; }
  }
}

async function saveOpsMonth(month, monthData) {
  // Save locally
  let all = {};
  try { all = JSON.parse(localStorage.getItem('se-ops-data') || '{}'); } catch {}
  all[month] = monthData;
  localStorage.setItem('se-ops-data', JSON.stringify(all));

  if (!isSupabaseReady()) return;
  try {
    await _sbClient.from('ops_data').upsert({
      month: month, data: monthData, updated_at: new Date().toISOString()
    }, { onConflict: 'month' });
  } catch (err) {
    console.warn('⚠️ Supabase saveOpsMonth failed:', err.message);
  }
}


// ============================================================
// KPI 目标
// ============================================================

async function getKpiTargets() {
  if (!isSupabaseReady()) {
    try { return JSON.parse(localStorage.getItem('se-kpi-targets') || 'null') || {}; } catch { return {}; }
  }
  try {
    const { data, error } = await _sbClient.from('kpi_targets').select('*').eq('id', 'global').single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    const targets = data?.targets || {};
    localStorage.setItem('se-kpi-targets', JSON.stringify(targets));
    return targets;
  } catch (err) {
    console.warn('⚠️ Supabase getKpiTargets failed:', err.message);
    try { return JSON.parse(localStorage.getItem('se-kpi-targets') || 'null') || {}; } catch { return {}; }
  }
}

async function saveKpiTargets(targets) {
  localStorage.setItem('se-kpi-targets', JSON.stringify(targets));
  if (!isSupabaseReady()) return;
  try {
    await _sbClient.from('kpi_targets').upsert({
      id: 'global', targets: targets, updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('⚠️ Supabase saveKpiTargets failed:', err.message);
  }
}


// ============================================================
// 用户同步
// ============================================================

async function syncUsers(users) {
  if (!isSupabaseReady()) return;
  try {
    // Get existing cloud users
    const { data: cloudUsers } = await _sbClient.from('users').select('name, role, password_hash');
    const existingUsers = new Map((cloudUsers || []).map(u => [u.name, u]));

    for (const user of users) {
      if (existingUsers.has(user.name)) {
        // Update role or password_hash if changed
        const existing = existingUsers.get(user.name);
        const updates = {};
        let needsUpdate = false;
        
        if (user.role && user.role !== existing.role) {
          updates.role = user.role;
          needsUpdate = true;
        }
        if (user.passwordHash && user.passwordHash !== existing.password_hash) {
          updates.password_hash = user.passwordHash;
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          updates.updated_at = new Date().toISOString();
          await _sbClient.from('users').update(updates).eq('name', user.name);
        }
      } else {
        // Insert new user
        await _sbClient.from('users').insert({
          name: user.name,
          role: user.role || 'teacher',
          password_hash: user.passwordHash || null
        });
        existingUsers.set(user.name, user);
      }
    }
  } catch (err) {
    console.warn('⚠️ User sync failed:', err.message);
  }
}

async function getAllUsers() {
  if (!isSupabaseReady()) {
    try { return JSON.parse(localStorage.getItem('se-users') || '[]'); } catch { return []; }
  }
  try {
    const { data, error } = await _sbClient.from('users').select('*').order('created_at');
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('⚠️ getAllUsers failed:', err.message);
    try { return JSON.parse(localStorage.getItem('se-users') || '[]'); } catch { return []; }
  }
}


// ============================================================
// 心跳 — 防止 Supabase 免费版暂停
// 每次页面加载时发送一个轻量查询
// ============================================================
function heartbeat() {
  if (!isSupabaseReady()) return;
  // 一个轻量 select count 查询，让项目保持活跃
  _sbClient.from('users').select('count', { count: 'exact', head: true })
    .then(() => console.log('💓 Supabase heartbeat OK'))
    .catch(() => {});
}

// 页面加载时心跳
setTimeout(heartbeat, 2000);


// ============================================================
// 管理员功能
// ============================================================

async function deleteUserAndData(userName) {
  if (!isSupabaseReady()) return { success: false, error: 'Cloud not ready' };
  try {
    // 1. Delete user's courses
    const { data: courses } = await _sbClient.from('courses').select('id').eq('teacher', userName);
    if (courses && courses.length > 0) {
      const courseIds = courses.map(c => c.id);
      await _sbClient.from('review_scores').delete().in('review_id',
        (await _sbClient.from('reviews').select('id').in('course_id', courseIds)).data?.map(r => r.id) || []
      );
      await _sbClient.from('reviews').delete().in('course_id', courseIds);
      await _sbClient.from('course_steps').delete().in('course_id', courseIds);
      await _sbClient.from('courses').delete().in('id', courseIds);
    }

    // 2. Delete user's PBL cases
    await _sbClient.from('pbl_cases').delete().eq('teacher', userName);

    // 3. Delete user's topics
    await _sbClient.from('topics').delete().eq('teacher', userName);

    // 4. Delete the user
    await _sbClient.from('users').delete().eq('name', userName);

    return { success: true, deletedCourses: courses?.length || 0 };
  } catch (err) {
    console.error('Delete user failed:', err);
    return { success: false, error: err.message };
  }
}

async function banUser(userName) {
  if (!isSupabaseReady()) return false;
  try {
    await _sbClient.from('users').update({ banned: true, updated_at: new Date().toISOString() }).eq('name', userName);
    return true;
  } catch (err) {
    console.warn('Ban user failed:', err.message);
    return false;
  }
}

async function unbanUser(userName) {
  if (!isSupabaseReady()) return false;
  try {
    await _sbClient.from('users').update({ banned: false, updated_at: new Date().toISOString() }).eq('name', userName);
    return true;
  } catch (err) {
    console.warn('Unban user failed:', err.message);
    return false;
  }
}

async function isUserBanned(userName) {
  if (!isSupabaseReady()) return false;
  try {
    const { data } = await _sbClient.from('users').select('banned').eq('name', userName).single();
    return data?.banned === true;
  } catch { return false; }
}

async function updateUserRole(userName, newRole) {
  if (!isSupabaseReady()) return false;
  try {
    await _sbClient.from('users').update({ role: newRole, updated_at: new Date().toISOString() }).eq('name', userName);
    return true;
  } catch (err) {
    console.warn('Update role failed:', err.message);
    return false;
  }
}

// ============================================================
// 全局设置（邀请码等）
// ============================================================

async function getSettings() {
  if (!isSupabaseReady()) return {};
  try {
    const { data, error } = await _sbClient.from('settings').select('*');
    if (error) throw error;
    const result = {};
    (data || []).forEach(r => { result[r.key] = r.value; });
    return result;
  } catch (err) {
    console.warn('getSettings failed:', err.message);
    return {};
  }
}

async function saveSetting(key, value) {
  if (!isSupabaseReady()) return false;
  try {
    await _sbClient.from('settings').upsert({ key, value }, { onConflict: 'key' });
    return true;
  } catch (err) {
    console.warn('saveSetting failed:', err.message);
    return false;
  }
}

async function getInviteCode() {
  const settings = await getSettings();
  return settings.invite_code || 'xinyutu2026';
}


// ============================================================
// 心跳 — 防止 Supabase 免费版暂停
// 每次页面加载时发送一个轻量查询
// ============================================================
function heartbeat() {
  if (!isSupabaseReady()) return;
  _sbClient.from('users').select('count', { count: 'exact', head: true })
    .then(() => console.log('💓 Supabase heartbeat OK'))
    .catch(() => {});
}

// 页面加载时心跳
setTimeout(heartbeat, 2000);


// ============================================================
// 家长拓客跟进 (Parent Leads CRM)
// ============================================================

async function getParentLeads() {
  if (!isSupabaseReady()) {
    try { return JSON.parse(localStorage.getItem('se-parent-leads') || '[]'); } catch { return []; }
  }
  try {
    const { data, error } = await _sbClient.from('ops_parent_leads').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    localStorage.setItem('se-parent-leads', JSON.stringify(data || []));
    return data || [];
  } catch (err) {
    console.warn('⚠️ Supabase getParentLeads failed, loading from local:', err);
    try { return JSON.parse(localStorage.getItem('se-parent-leads') || '[]'); } catch { return []; }
  }
}

async function saveParentLead(lead) {
  // Save locally
  let all = [];
  try { all = JSON.parse(localStorage.getItem('se-parent-leads') || '[]'); } catch {}
  const idx = all.findIndex(l => l.id === lead.id);
  if (idx >= 0) {
    all[idx] = lead;
  } else {
    all.unshift(lead);
  }
  localStorage.setItem('se-parent-leads', JSON.stringify(all));

  if (!isSupabaseReady()) return;
  try {
    const row = {
      id: lead.id,
      parent_name: lead.parent_name,
      parent_phone: lead.parent_phone,
      child_name: lead.child_name || null,
      child_age: lead.child_age || null,
      source: lead.source || null,
      interest_modules: lead.interest_modules || [],
      status: lead.status || 'new',
      remarks: lead.remarks || null,
      follow_up_logs: lead.follow_up_logs || [],
      last_follow_up: lead.last_follow_up || new Date().toISOString().split('T')[0],
      created_at: lead.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await _sbClient.from('ops_parent_leads').upsert(row, { onConflict: 'id' });
  } catch (err) {
    console.warn('⚠️ Supabase saveParentLead failed:', err);
  }
}

async function deleteParentLead(leadId) {
  // Delete locally
  let all = [];
  try { all = JSON.parse(localStorage.getItem('se-parent-leads') || '[]'); } catch {}
  all = all.filter(l => l.id !== leadId);
  localStorage.setItem('se-parent-leads', JSON.stringify(all));

  if (!isSupabaseReady()) return;
  try {
    await _sbClient.from('ops_parent_leads').delete().eq('id', leadId);
  } catch (err) {
    console.warn('⚠️ Supabase deleteParentLead failed:', err);
  }
}

// ============================================================
// 家长转介绍记录 (Referrals)
// ============================================================
const REFERRALS_LOCAL_KEY = 'se-referrals';

async function getReferrals() {
  if (isSupabaseReady()) {
    try {
      const { data, error } = await _sbClient
        .from('ops_referrals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Sync to local as cache
      localStorage.setItem(REFERRALS_LOCAL_KEY, JSON.stringify(data || []));
      return data || [];
    } catch (err) {
      console.warn('⚠️ Supabase getReferrals failed, loading from local:', err);
    }
  }
  try { return JSON.parse(localStorage.getItem(REFERRALS_LOCAL_KEY) || '[]'); } catch { return []; }
}

async function saveReferral(referral) {
  const row = {
    id: referral.id,
    referrer_name: referral.referrer_name,
    referrer_phone: referral.referrer_phone || '',
    referree_name: referral.referree_name,
    referree_phone: referral.referree_phone || '',
    referral_date: referral.referral_date || new Date().toISOString().split('T')[0],
    reward_type: referral.reward_type || 'none',
    reward_given: referral.reward_given || false,
    reward_note: referral.reward_note || '',
    lead_id: referral.lead_id || null,
    status: referral.status || 'pending',
    notes: referral.notes || '',
    created_at: referral.created_at || new Date().toISOString(),
  };
  // Update local cache
  try {
    const local = JSON.parse(localStorage.getItem(REFERRALS_LOCAL_KEY) || '[]');
    const idx = local.findIndex(r => r.id === row.id);
    if (idx >= 0) local[idx] = row; else local.unshift(row);
    localStorage.setItem(REFERRALS_LOCAL_KEY, JSON.stringify(local));
  } catch {}

  if (isSupabaseReady()) {
    try {
      await _sbClient.from('ops_referrals').upsert(row, { onConflict: 'id' });
    } catch (err) {
      console.warn('⚠️ Supabase saveReferral failed:', err);
    }
  }
}

async function deleteReferral(referralId) {
  // Update local cache
  try {
    const local = JSON.parse(localStorage.getItem(REFERRALS_LOCAL_KEY) || '[]');
    localStorage.setItem(REFERRALS_LOCAL_KEY, JSON.stringify(local.filter(r => r.id !== referralId)));
  } catch {}

  if (isSupabaseReady()) {
    try {
      await _sbClient.from('ops_referrals').delete().eq('id', referralId);
    } catch (err) {
      console.warn('⚠️ Supabase deleteReferral failed:', err);
    }
  }
}

async function syncLocalStorageToCloud() {
  if (!isSupabaseReady()) return;
  const SYNC_FLAG = 'se-synced-local-to-cloud-20260531';
  if (localStorage.getItem(SYNC_FLAG) === 'true') return;

  console.log('🔄 检测到未同步的本地历史数据，开始自动迁移至云端...');

  try {
    // 1. 同步注册用户
    const localUsers = JSON.parse(localStorage.getItem('se-registered-users') || '[]');
    if (localUsers.length > 0) {
      console.log(`👤 正在云端同步 ${localUsers.length} 个注册用户...`);
      await syncUsers(localUsers);
    }

    // 2. 同步家长线索 (CRM)
    const localLeads = JSON.parse(localStorage.getItem('se-parent-leads') || '[]');
    if (localLeads.length > 0) {
      console.log(`📞 正在云端同步 ${localLeads.length} 个家长线索...`);
      for (const lead of localLeads) {
        const row = {
          id: lead.id,
          parent_name: lead.parent_name,
          parent_phone: lead.parent_phone || null,
          child_name: lead.child_name || null,
          child_age: lead.child_age || null,
          source: lead.source || null,
          interest_modules: lead.interest_modules || [],
          status: lead.status || 'new',
          remarks: lead.remarks || null,
          follow_up_logs: lead.follow_up_logs || [],
          last_follow_up: lead.last_follow_up || new Date().toISOString().split('T')[0],
          created_at: lead.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await _sbClient.from('ops_parent_leads').upsert(row, { onConflict: 'id' });
      }
    }

    // 3. 同步 PBL 案例
    const localCases = JSON.parse(localStorage.getItem('se-pbl-cases') || '[]');
    if (localCases.length > 0) {
      console.log(`📦 正在云端同步 ${localCases.length} 个 PBL 案例...`);
      for (const c of localCases) {
        const row = {
          id: c.id,
          title: c.title || '无标题案例',
          teacher: c.teacher || '教师',
          age: c.age || '常规',
          type: c.type || '常规课',
          modules: c.modules || [],
          eq: c.eq || null,
          knowledge: c.knowledge || null,
          design: c.design || null,
          handson: c.handson || null,
          reflect: c.reflect || null,
          background: c.background || null,
          highlights: c.highlights || null,
          pitfalls: c.pitfalls || null,
          ppt_files: c.pptFiles || [],
          comments: c.comments || [],
          likes: c.likes || 0,
          submitted_at: c.submittedAt || new Date().toISOString(),
        };
        await _sbClient.from('pbl_cases').upsert(row, { onConflict: 'id' });
      }
    }

    // 4. 同步选题库
    const localTopics = JSON.parse(localStorage.getItem('se-topics') || '[]');
    if (localTopics.length > 0) {
      console.log(`💡 正在云端同步 ${localTopics.length} 个选题...`);
      for (const t of localTopics) {
        const row = {
          id: t.id,
          title: t.title || '',
          teacher: t.teacher || '',
          module: (t.modules && t.modules[0]) || t.module || '',
          age: t.age || '',
          type: t.type || '',
          eq: t.driving || t.eq || '',
          outline: t.outline || '',
          status: t.status || 'pending',
          reviews: t.reviews || [],
          full_data: t,
          submitted_at: t.submittedAt || new Date().toISOString(),
        };
        await _sbClient.from('topics').upsert(row, { onConflict: 'id' });
      }
    }

    // 5. 同步运营数据
    const localOps = JSON.parse(localStorage.getItem('se-ops-data') || '{}');
    const opsKeys = Object.keys(localOps);
    if (opsKeys.length > 0) {
      console.log(`📊 正在云端同步运营数据 (${opsKeys.join(', ')})...`);
      for (const [month, data] of Object.entries(localOps)) {
        await _sbClient.from('ops_data').upsert({
          month,
          data,
          updated_at: new Date().toISOString()
        }, { onConflict: 'month' });
      }
    }

    // 6. 同步 KPI 目标
    const localKpis = JSON.parse(localStorage.getItem('se-kpi-targets') || 'null');
    if (localKpis && typeof localKpis === 'object') {
      console.log(`🎯 正在云端同步 KPI 目标...`);
      await _sbClient.from('kpi_targets').upsert({
        id: 'global',
        targets: localKpis,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    }

    // 7. 同步课程 (Courses, Steps, Reviews, Scores)
    const localCourses = JSON.parse(localStorage.getItem('se-courses') || '[]');
    if (localCourses.length > 0) {
      console.log(`📖 正在云端同步 ${localCourses.length} 个课程及其教学流程和评审记录...`);
      for (const cData of localCourses) {
        const teacher = await getOrCreateUser(cData.teacher || '教师', 'teacher');
        
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cData.id);
        
        const coursePayload = {
          teacher_id:       teacher.id,
          name:             cData.name || '未命名课程',
          module:           cData.module || 'STEAM',
          age_group:        cData.age || '6-8岁',
          course_type:      cData.type || '常规课',
          duration:         cData.duration || '3小时',
          ability:          cData.ability || '',
          alignment:        cData.alignment || '',
          diff_from_school: cData.diff || '',
          driving_question: cData.driving || '',
          is_dual_track:    cData.dualTrack || false,
          steam_knowledge:  cData.steamKnowledge || null,
          steam_handson:    cData.steamHandson || null,
          steam_solution:   cData.steamSolution || null,
          hum_inquiry:      cData.humInquiry || null,
          hum_discussion:   cData.humDiscussion || null,
          hum_resource:     cData.humResource || null,
          convergence:      cData.convergence || null,
          knowledge:        cData.knowledge || null,
          solution:         cData.solution || null,
          handson:          cData.handson || null,
          reflect:          cData.reflect || '',
          materials:        cData.materials || '无',
          safety:           cData.safety || null,
          status:           cData.status || 'pending',
          submitted_at:     cData.submittedAt || new Date().toISOString()
        };

        if (isUUID) {
          coursePayload.id = cData.id;
        }

        const { data: dbCourse, error: cErr } = await _sbClient
          .from('courses')
          .upsert(coursePayload, { onConflict: 'id' })
          .select()
          .single();

        if (cErr) {
          console.warn('❌ 课程迁移失败:', cErr.message);
          continue;
        }

        const courseId = dbCourse.id;

        if (cData.steps && cData.steps.length > 0) {
          await _sbClient.from('course_steps').delete().eq('course_id', courseId);
          const steps = cData.steps.map((step, i) => ({
            course_id:  courseId,
            sort_order: i + 1,
            duration:   step.duration || '15分钟',
            content:    step.content || '',
          }));
          await _sbClient.from('course_steps').insert(steps);
        }

        if (cData.reviews && cData.reviews.length > 0) {
          for (const rev of cData.reviews) {
            const reviewer = await getOrCreateUser(rev.reviewer || '评审员', 'reviewer');
            const { data: dbRev, error: rErr } = await _sbClient
              .from('reviews')
              .upsert({
                course_id:   courseId,
                reviewer_id: reviewer.id,
                comment:     rev.comment || rev.feedback || null,
                created_at:  rev.date || new Date().toISOString()
              }, { onConflict: 'course_id, reviewer_id' })
              .select()
              .single();

            if (rErr) continue;

            if (rev.scores && typeof rev.scores === 'object') {
              const scores = Object.entries(rev.scores).map(([dimKey, grade]) => ({
                review_id:     dbRev.id,
                dimension_key: dimKey,
                grade:         grade,
              }));
              await _sbClient.from('review_scores').upsert(scores, { onConflict: 'review_id, dimension_key' });
            }
          }
        }
      }
    }

    localStorage.setItem(SYNC_FLAG, 'true');
    console.log('✅ 所有本地历史数据已顺利迁移并同步至云端！');
  } catch (err) {
    console.error('⚠️ 本地数据同步至云端发生错误:', err);
  }
}


// ============================================================
// 导出（全局挂载，供其他 JS 文件调用）
// ============================================================
window.StarEarthDB = {
  isSupabaseReady,
  syncLocalStorageToCloud,
  getOrCreateUser,
  // Courses
  createCourse, getCourses, getCourse,
  createReview, getReviewSummary, getReviewDimensions,
  deleteCourse, updateCourse,
  // PBL Cases
  getCases, saveCase, saveCases, deleteCase,
  // Topics
  getTopics, saveTopics, saveTopic, deleteTopic,
  // Ops
  getOpsData, saveOpsMonth,
  // KPI
  getKpiTargets, saveKpiTargets,
  // Users
  syncUsers, getAllUsers,
  // Admin
  deleteUserAndData, banUser, unbanUser, isUserBanned, updateUserRole,
  // Settings
  getSettings, saveSetting, getInviteCode,
  // Parent Leads CRM
  getParentLeads, saveParentLead, deleteParentLead,
  // Referrals (转介绍)
  getReferrals, saveReferral, deleteReferral,
  // Heartbeat
  heartbeat,
};
