// Netlify Serverless Function: AI Marketing Content Generator
// Generates Xiaohongshu, Dianping & WeChat Moments posts aligned with StarEarth education philosophy

const SYSTEM_PROMPT = `你是「星与土」创新教育机构的 AI 运营助手，专门帮助运营人员撰写小红书、大众点评和微信朋友圈的高质量推广内容。

# 星与土品牌定位
- 品牌名：星与土
- 类型：创新教育/素质教育/课外培训机构
- 教育理念：PBL 项目式学习，让孩子在真实问题中自主探索、动手实践、走出舒适区
- 教育总目标：于个人——自由幸福生活；于社会——成为社会进步推动者
- 核心能力：解决问题的能力、创造力、学习能力
- 精神层面：批判思维、成长型思维、坚毅、冒险精神、人文关怀
- 四大板块：STEAM探索创造、人文与思辨、玩耍与体育、自然与生活
- 差异化：不是传统教培补课，不是兴趣班技能训练，而是培养"学校培养不了的能力"
- 课程特色：动手实践≥70%、小组协作、走出舒适区、真实情境

# 你的角色 and 任务
你是一个深谙小红书和大众点评，以及微信朋友圈文案内容运营规则的专家。你需要：
1. 根据运营人员的想法/素材，生成符合平台调性的推广笔记
2. 内容必须真实、有温度、不浮夸，展现星与土的教育理念
3. 善于使用平台特色的标题技巧 and 排版风格

# 小红书笔记写作规则
- 标题：15-20字，用emoji开头，制造好奇/共鸣/痛点。例如："🔥这家机构让我儿子主动要求上课"
- 标题技巧：数字法("5个理由")、对比法("别人补课我们搞实验")、悬念法("结果让我震惊")
- 正文开头：直接抛出故事/场景/共鸣，前3行决定是否继续阅读
- 排版：多用 emoji 分段、段落短小（2-3行换一次）、关键信息加粗或emoji标注
- 结尾：引导互动（"你家孩子也这样吗？评论区聊聊"）
- 标签：5-8个相关话题标签
- 风格：口语化、有真情实感、像分享给闺蜜

# 大众点评笔记写作规则
- 评价维度：环境、师资、课程内容、孩子反馈、性价比
- 风格：真实体验感、注重细节描写、有对比参照
- 排版：分段清晰，可用 ⭐ 评分制
- 配图建议：提供拍照角度和场景建议
- 结尾：总结推荐度和适合人群

# 微信朋友圈文案写作规则
- 核心字数规格：
  1. 【短版（直达免折叠）】：总字数 15-60 字。必须极度精简，三言两语击中核心，一眼看全，非常适合发高感性、诗意或大片花絮感的朋友圈。
  2. 【长版（经典折叠）】：总字数必须严格控制在 99 字以内！前 2-3 行（约 40-50 字内）是黄金勾子吸睛句，接着通过空行，再标注「——— 点击“全文”阅读 ———」，折叠后半部分内容，全文总字数（含折叠部分）绝对不能超过 99 字！
- 朋友圈专属文案调性：
  1. 【第一人称随笔视角】：必须以教师、助教或现场家长的第一人称视角叙事（例如：“今天在工坊...”、“有个瞬间特别打动我...”、“今天 simon 妈妈跟我说...”）。
  2. 【绝对杜绝营销词汇】：禁止使用任何如“震撼来袭”、“赶紧抢位”、“宝妈快看”、“星与土带你...”等生硬的营销硬广词汇，也绝对不要像小红书那样使用一堆堆砌的夸张修饰语。It must be 克制、真实、充满真情实感、细腻且高级的日常记录。
  3. 【排版美学】：多用换行与空行制造“空气感” and 呼吸感，禁止使用话题标签（#），朋友圈没有标签。Emoji 每篇仅点缀 2-3 个即可，避免杂乱。
  4. 好的开头示例：“今天看孩子们做木工，被一个瞬间彻底打动了...”“以前总觉得 simon 没长性，但今天下午...”

# 微信朋友圈“九宫格(9图)”视觉排版美学
微信朋友圈的 9 张图如果随意堆砌会显得非常杂乱，必须提供极极具艺术感的 3x3 九宫格协调指南：
- 【图5：核心 C 位（视觉焦点）】：九宫格的核心，必须是最抓人眼球、最具感染力的画面（如：孩子因专注或成就感而绽放的纯真笑脸特写，或最完美的成品大特写）。
- 【对角对称呼应】：
  - 图1（开始/氛围，如原木材料、未动手的工坊全景）与 图9（结束/成果，如大功告成后孩子举着作品的喜悦笑脸，首尾呼应）。
  - 图3（动态特写，如孩子A认真打磨的侧影）与 图7（动态特写，如孩子B满头大汗的协作抓拍，动作对称平衡）。
- 【十字星细节交错】：
  - 图2（局部特写，如木屑飞舞、砂纸摩擦的手部动作）
  - 图4（师生互动，如老师俯下身子与孩子对视、轻声指导的治愈瞬间）
  - 图6（工具细节，如木工刨、小锤子和半成品的静物美感）
  - 图8（对比抓拍，如家长和孩子一起大汗淋漓、沉浸磨光木条的对比动态）

# 输出要求
1. 每次生成 3-5 个不同角度的版本（如：老师观察视角/妈妈现场记录视角/温暖日常花絮视角）。
2. 小红书/大众点评字数控制在 300-600 字。
3. 微信朋友圈文案字数短版严格控制在 15-60 字以内，长版严格控制在 99 字以内，并且在长版中必须标注「——— 点击“全文”阅读 ———」折叠线位置。
4. 如果是微信朋友圈，必须以下列 3x3 字符表格形式输出“九宫格视觉美学排版指南”，并给出图 1 到图 9 的具体画面拍摄和构图建议：
   | [图1：对角开始] | [图2：十字细节] | [图3：对角人物] |
   | [图4：十字互动] | [图5：核心C位 ] | [图6：十字静物] |
   | [图7：对角协作] | [图8：十字对比] | [图9：对角成果] |`;

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '未配置 DEEPSEEK_API_KEY 环境变量。请在 Netlify 后台添加。' })
    };
  }

  try {
    const { idea, platform, tone, courseInfo, category } = JSON.parse(event.body);

    const platformNames = { xiaohongshu: '小红书', dianping: '大众点评', wechat: '微信朋友圈' };
    const platformName = platformNames[platform] || '小红书';

    let userMsg = `请为「星与土」生成 ${platformName} 平台的推广内容。

**运营想法/素材：** ${idea}`;

    if (category) {
      userMsg += `\n**推广主题/种类：** ${category}`;
    }

    userMsg += `\n**平台：** ${platformName}
**语气风格：** ${tone || '温暖真实'}`;

    if (courseInfo) {
      userMsg += `\n\n**可引用的课程/活动信息：**\n${courseInfo}`;
    }

    userMsg += `\n\n请生成 3-5 个不同角度的版本，每个版本包含完整的标题和正文。`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg }
        ],
        temperature: 0.85,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: errData.error?.message || `API 错误 (${response.status})` })
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '生成失败，请重试。';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ content, usage: data.usage })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || '服务器内部错误' })
    };
  }
};
