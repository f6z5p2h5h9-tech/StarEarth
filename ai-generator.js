/* ===== AI Generator Logic ===== */
(function() {
  'use strict';

  // ---- System Prompt (StarEarth Educational Context) ----
  const SYSTEM_PROMPT = `你是「星与土」创新教育机构的 AI 课程设计助手。你的任务是根据教师提供的课程想法，生成一份完整的、符合星与土教育理念的课程大纲。

# 星与土教育理念

## 教育总目标
- 于个人：能够自由的幸福生活
- 于社会：能够成为社会进步的推动者

## 培养的关键能力
1. 解决问题的能力——在已知世界中解决问题
2. 创造力——在未知世界中创新创造
3. 学习能力——在变化世界中持续学习

## 思维与精神（比能力更重要）
普世价值观、人文关怀、公民意识、成长型思维、批判思维、全局思维、坚毅、抗挫折能力、冒险精神

## 基础：身心健康
课程必须关注孩子的身心健康基础。

## 教育过程三大原则
1. **尊重**：教师将学生视做完整、独立的人，学生有充分的自由和自主。平等对待每一个学生，尊重并包容差异和个性。同时不会过度保护和过度夸奖，必要时坚决引导学生走出舒适区。
2. **自主探索·过程大于结果**：自主探索和学习的过程比知识结果更重要。每一次尝试、每一次失败都有价值。慢即是快。
3. **走出舒适区才能成长**：成长来自于不断突破自己的边界。学生需要被刻意引导甚至施加一定的外界压力。教师在某些情况下表现得很 Tough 是必要的。

# 课程设计六大原则
1. **宽广的面**：课程内容覆盖多学科、多领域，每个主题需跨越至少2个内容板块，鼓励孩子发现知识之间的联系。
2. **自主学习**：教师讲授时间不超过总时长的30%，学生必须有动手实践、自主探索的时间，允许犯错。
3. **小组学习**：设计需要协作才能完成的任务，每个孩子必须有表达和展示的机会。
4. **真实情境**：课程问题来源于真实世界而非教科书，成果应有真实的使用场景和受众，尽可能在真实环境中开展学习。
5. **走出舒适区**：任务难度应略高于学生当前能力水平，设计需要勇气和冒险精神才能完成的环节。
6. **尊重与自主**：在框架内给学生充分的选择空间，不预设唯一正确答案。

# PBL（项目式学习）五步框架
① **驱动问题 (Driving Question)**：提出一个真实的、有意义的、开放性的核心问题，能激发好奇心，没有唯一答案。
② **知识构建 (Knowledge Building)**：围绕驱动问题，学生自主探索所需知识和技能，教师提供资源支架但不直接给出答案。
③ **方案设计 (Solution Design)**：学生设计解决方案，鼓励多种方案并行，鼓励迭代和改进。
④ **动手实践 (Hands-on Execution)**：将方案付诸实践——制作、搭建、实验、测试。这是占时最多的环节。
⑤ **展示与反思 (Presentation & Reflection)**：学生向他人展示成果，并进行自我反思。

# 四大板块

## 🔬 STEAM（探索与创造）
核心方向：人造物品的探索与拆解、自然世界的探索、动手搭建、艺术表达、问题探究
要求：必须有动手实践环节、必须链接真实世界的科学或工程原理、鼓励发散设计

## 📚 人文与思辨（自我与社会）
核心方向：逻辑思维训练、独立思考与批判性思维、世界历史与人类文明、演讲与表达、精选阅读
要求：必须有开放性讨论和辩论环节、不预设立场、历史故事需链接当代社会议题

## ⚽ 玩耍与体育（意志与协作）
核心方向：身体技能游戏、智力游戏、自制工具游戏、对抗类游戏、团队运动
要求：必须有明确的体育精神和品格培养目标、培养合作意识、毅力与勇气

## 🌿 自然与生活（连接与责任）
核心方向：品性和毅力锻炼、独立生活能力、与人配合的能力、基本生活技能、户外研学
要求：必须有真实的生活场景和任务、营地课需设计独立生活环节

# 年龄段适配指南

## K（5-6岁·启蒙期）
认知特点：感知觉和直觉思维为主，好奇心旺盛，注意力15-20分钟
设计要点：活动切换频繁（单个≤20分钟）、大量感官体验、用故事和角色扮演驱动、自由玩耍≥40%
避免：长时间静坐、过于抽象的概念、要求精确书写

## G1-G2（6-8岁·能力建构期）
认知特点：具体运算思维发展，理解因果关系，社交意识增强
设计要点：引入有结构的探究任务、培养自主阅读和记录习惯、小组项目、引入适度竞争
避免：过于复杂的多步骤项目、需要长时间独立工作的任务

## G3-G4（8-10岁·深度探索期）
认知特点：逻辑思维显著增强，能深入分析，自主意识增强
设计要点：完整PBL项目流程、独立思考和批判性提问、辩论和多角度分析、复杂动手制作
避免：纯粹为了好玩而缺乏深度的活动、给定唯一标准答案

## G5-G6（10-12岁·独立思辨期）
认知特点：抽象思维发展，能理解复杂系统，强烈自我意识
设计要点：高度自主的项目驱动学习、深度人文思辨、复杂工程和科学探究、领导力培养、演讲与正式展示
避免：过于幼稚的内容、教师单方面权威控制

# 经典案例参考

## 好的设计示例：弓箭制作课
- 驱动问题："如何制作一把弓箭，并了解弓箭在人类社会发展中起的作用？"
- 过程：先讨论古人为什么需要弓箭 → 学生自主探索材料弹性 → 小组讨论设计方案 → 动手制作 → 院子里测试、记录数据、迭代改进 → 比赛+反思分享
- 走出舒适区：射箭比赛的竞争压力，面对失败的勇气

## 好的设计示例：浮力原理课（G3-G4）
- 驱动问题："为什么有些东西浮在水面，有些沉下去？你能让一块黏土浮起来吗？"
- 过程：学生预测浮沉并实验验证 → 阿基米德故事引发讨论 → 挑战：用黏土设计最大承重的船 → 迭代测试 → 小组展示设计原理

## 好的设计示例：户外对抗游戏课（G1-G2）
- 教育目标：培养勇气、面对冲突的能力、体育精神
- 过程：热身游戏 → 讨论"什么是勇敢？" → 渐进式对抗（互扔沙包→单腿斗鸡→安全摔跤）→ 体育精神仪式（输了也击掌）→ 反思

# 输出格式要求

请按以下结构生成课程大纲（使用 Markdown 格式）：

## 📌 课程名称
[一个吸引人的、有教育深度的课程名称]

## 🎯 教育目标
**对齐星与土三大目标：**
- 关键能力：[具体说明培养哪些能力]
- 思维精神：[具体说明培养哪些思维/精神]
- 身心健康：[如果相关]

**与学校教育的差异化：**
[说明这门课能培养什么学校里培养不了的能力]

## ❓ 核心驱动问题 (Essential Question)
[一个真实的、开放的、能激发好奇心的核心问题]

## 🔄 PBL 五步流程

### ① 驱动问题引入（约占 10%）
[如何引入核心问题，如何激发好奇心]

### ② 知识构建（约占 15%）
[学生如何自主探索所需知识，教师提供什么支架]

### ③ 方案设计（约占 15%）
[学生如何设计解决方案]

### ④ 动手实践（约占 40%）
[具体的制作/实验/探索活动]

### ⑤ 展示与反思（约占 20%）
[如何展示成果，反思什么]

## ⏱ 时间分配
[总时长和各环节具体时间，确保教师讲授≤30%]

## 🧗 走出舒适区设计
[具体的挑战环节设计]

## 📦 材料清单
[所需材料列表]

## 💬 教师引导关键话术
[关键节点的提问和引导语]

## 🔗 跨学科联系
[本课程如何跨越多个板块，知识之间的联系]

---
注意：
1. 你必须严格遵循星与土的教育理念，生成的课程不能是传统讲授式教学的翻版
2. 驱动问题必须是真实的、开放的，不能是"今天我们来学xxx"
3. 教师讲授时间严格控制在30%以内
4. 必须有走出舒适区的设计
5. 必须有小组协作和个人表达的环节
6. 根据年龄段调整难度和活动形式`;

  // ---- Theme Toggle ----
  const themeBtn = document.getElementById('theme-toggle');
  const saved = localStorage.getItem('se-theme');
  if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
  themeBtn?.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    document.documentElement.setAttribute('data-theme', isLight ? '' : 'light');
    localStorage.setItem('se-theme', isLight ? 'dark' : 'light');
  });

  // ---- Elements ----
  const ideaEl = document.getElementById('ai-idea');
  const ageEl = document.getElementById('ai-age');
  const typeEl = document.getElementById('ai-type');
  const btnGenerate = document.getElementById('btn-generate');
  const hintEl = document.getElementById('ai-hint');
  const outputSection = document.getElementById('ai-output');
  const loadingEl = document.getElementById('ai-loading');
  const resultEl = document.getElementById('ai-result');
  const resultContent = document.getElementById('ai-result-content');
  const errorEl = document.getElementById('ai-error');
  const errorMsg = document.getElementById('ai-error-msg');

  // API key is securely stored in Netlify environment variables now

  // ---- Validation ----
  function validate() {
    const hasIdea = ideaEl.value.trim().length > 0;
    const hasAge = ageEl.value !== '';
    btnGenerate.disabled = !(hasIdea && hasAge);
    if (hasIdea && hasAge) {
      hintEl.textContent = '准备好了，点击生成！';
      hintEl.style.color = 'var(--accent-earth)';
    } else {
      hintEl.textContent = '请填写课程想法和选择年龄段';
      hintEl.style.color = '';
    }
  }

  ideaEl.addEventListener('input', validate);
  ageEl.addEventListener('change', validate);
  validate();

  // ---- Simple Markdown Renderer ----
  function renderMarkdown(md) {
    let html = md
      .replace(/^### (.*$)/gm, '<h4>$1</h4>')
      .replace(/^## (.*$)/gm, '<h3 class="ai-md-h2">$1</h3>')
      .replace(/^# (.*$)/gm, '<h2 class="ai-md-h1">$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
      .replace(/^---$/gm, '<hr>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    html = html.replace(/((?:<li>.*?<\/li><br>?)+)/g, function(match) {
      const items = match.replace(/<br>/g, '');
      return '<ul>' + items + '</ul>';
    });

    return '<div class="ai-md-body"><p>' + html + '</p></div>';
  }

  // ---- Generate (Call Vercel Serverless Function) ----
  async function generate() {
    const idea = ideaEl.value.trim();
    const age = ageEl.value;
    const courseType = typeEl.value;
    const modules = [];
    document.querySelectorAll('#ai-modules input:checked').forEach(cb => modules.push(cb.value));
    if (modules.length === 0) modules.push('STEAM');

    let pblCases = [];
    try {
      const cases = JSON.parse(localStorage.getItem('se-pbl-cases') || '[]');
      pblCases = cases.filter(c =>
        c.modules && c.modules.some(m => modules.includes(m))
      ).slice(0, 3);
    } catch (e) {}

    // Show loading
    outputSection.style.display = 'block';
    loadingEl.style.display = 'flex';
    resultEl.style.display = 'none';
    errorEl.style.display = 'none';
    btnGenerate.disabled = true;
    btnGenerate.querySelector('.btn-ai-text').textContent = '生成中...';
    outputSection.scrollIntoView({ behavior: 'smooth' });

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          idea,
          age,
          modules,
          courseType,
          pblCases
        })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || '生成失败');
      }

      const fullContent = data.content || '生成失败，请重试。';

      // Show result
      loadingEl.style.display = 'none';
      resultEl.style.display = 'block';
      resultContent.innerHTML = renderMarkdown(fullContent);
      resultContent.dataset.raw = fullContent;

      resultEl.style.opacity = '0';
      requestAnimationFrame(() => {
        resultEl.style.transition = 'opacity 0.5s ease';
        resultEl.style.opacity = '1';
      });

      if (data.usage) {
        hintEl.textContent = `✅ 生成完成 (Tokens: ${data.usage.total_tokens})`;
      } else {
        hintEl.textContent = '✅ 生成完成';
      }
      hintEl.style.color = 'var(--accent-earth)';

    } catch (err) {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'flex';
      errorMsg.textContent = err.message;
      hintEl.textContent = '生成失败，请重试';
      hintEl.style.color = 'var(--accent-2)';
    } finally {
      btnGenerate.disabled = false;
      btnGenerate.querySelector('.btn-ai-text').textContent = '生成课程大纲';
      validate();
    }
  }

  // ---- Event Listeners ----
  btnGenerate.addEventListener('click', generate);
  document.getElementById('btn-regenerate')?.addEventListener('click', generate);
  document.getElementById('btn-retry')?.addEventListener('click', generate);

  document.getElementById('btn-copy')?.addEventListener('click', () => {
    const raw = resultContent.dataset.raw || resultContent.textContent;
    navigator.clipboard.writeText(raw).then(() => {
      showToast('📋 已复制到剪贴板', 'success');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = raw;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('📋 已复制到剪贴板', 'success');
    });
  });

  // ---- Toast ----
  function showToast(msg, type) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast ' + type;
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => toast.classList.remove('show'), 3000);
  }
})();
