-- =============================================================
-- StarEarth 星与土 · 课程管理系统 — Supabase 初始化迁移
-- 适用于 Supabase (PostgreSQL 15+)
-- =============================================================

-- 启用必要扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- 1. users — 用户表
-- 关联 Supabase Auth，角色区分教师/评审人/管理员
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id    UUID UNIQUE,                           -- 关联 auth.users.id（上线后绑定）
  name       TEXT NOT NULL,
  email      TEXT UNIQUE,
  role       TEXT NOT NULL DEFAULT 'teacher'
             CHECK (role IN ('teacher', 'reviewer', 'admin')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  users IS '星与土用户表：教师、评审员、管理员';
COMMENT ON COLUMN users.role IS '角色：teacher=课程教师, reviewer=评审人, admin=管理员';
COMMENT ON COLUMN users.auth_id IS '关联 Supabase Auth 用户ID，正式上线后绑定';

-- 索引
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_auth_id ON users (auth_id) WHERE auth_id IS NOT NULL;


-- =============================================================
-- 2. courses — 课程方案表（核心表）
-- 包含单线/双线并行 PBL 设计的所有字段
-- =============================================================
CREATE TABLE IF NOT EXISTS courses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- 基础信息
  name              TEXT NOT NULL,
  module            TEXT NOT NULL
                    CHECK (module IN ('STEAM', '人文与思辨', '玩耍与体育', '自然与生活')),
  age_group         TEXT NOT NULL
                    CHECK (age_group IN ('5-6岁', '6-8岁', '8-10岁', '10-12岁')),
  course_type       TEXT NOT NULL
                    CHECK (course_type IN ('常规课', '营地课', '户外研学')),
  duration          TEXT NOT NULL,                   -- 如 "3小时" / "5天"

  -- 教育目标
  ability           TEXT NOT NULL,                   -- 能力目标
  alignment         TEXT NOT NULL,                   -- 与总目标的对齐说明
  diff_from_school  TEXT NOT NULL,                   -- 与学校教育的差异化

  -- PBL 设计
  driving_question  TEXT NOT NULL,                   -- 驱动问题
  is_dual_track     BOOLEAN NOT NULL DEFAULT false,  -- 是否双线并行

  -- 双线模式字段（is_dual_track = true 时使用）
  steam_knowledge   TEXT,                            -- STEAM线：探索与知识构建
  steam_handson     TEXT,                            -- STEAM线：动手实践
  steam_solution    TEXT,                            -- STEAM线：方案设计引导
  hum_inquiry       TEXT,                            -- 人文线：探究与思辨
  hum_discussion    TEXT,                            -- 人文线：讨论与表达
  hum_resource      TEXT,                            -- 人文线：资源支架
  convergence       TEXT,                            -- 双线汇合点

  -- 单线模式字段（is_dual_track = false 时使用）
  knowledge         TEXT,                            -- 知识构建安排
  solution          TEXT,                            -- 方案设计引导
  handson           TEXT,                            -- 动手实践

  -- 共用字段
  reflect           TEXT,                            -- 展示与反思
  materials         TEXT NOT NULL,                   -- 材料清单
  safety            TEXT,                            -- 安全注意事项

  -- 评审状态
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'passed', 'needs_revision', 'rejected')),

  -- 时间戳
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  courses IS '课程方案主表，包含单线和双线并行PBL设计';
COMMENT ON COLUMN courses.is_dual_track IS 'true=双线并行（STEAM+人文），false=传统单线PBL';
COMMENT ON COLUMN courses.status IS '评审状态：pending=待评审, passed=通过, needs_revision=需修改, rejected=不通过';

-- 索引：按常见查询模式建立
CREATE INDEX idx_courses_teacher     ON courses (teacher_id);
CREATE INDEX idx_courses_module      ON courses (module);
CREATE INDEX idx_courses_age_group   ON courses (age_group);
CREATE INDEX idx_courses_status      ON courses (status);
CREATE INDEX idx_courses_submitted   ON courses (submitted_at DESC);

-- 复合索引：板块 + 年龄段筛选（最常见的组合查询）
CREATE INDEX idx_courses_module_age ON courses (module, age_group);


-- =============================================================
-- 3. course_steps — 教学流程步骤表
-- 一门课程包含多个有序的教学环节
-- =============================================================
CREATE TABLE IF NOT EXISTS course_steps (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sort_order INT  NOT NULL DEFAULT 0,                -- 排序号（1, 2, 3...）
  duration   TEXT NOT NULL,                          -- 时长，如 "15分钟"
  content    TEXT NOT NULL,                          -- 活动内容与教师引导

  UNIQUE (course_id, sort_order)
);

COMMENT ON TABLE course_steps IS '课程教学流程步骤，按 sort_order 排序';

-- 索引
CREATE INDEX idx_steps_course ON course_steps (course_id, sort_order);


-- =============================================================
-- 4. review_dimensions — 评审维度配置表
-- 存储评审的 5 个打分维度及其权重（配置数据）
-- =============================================================
CREATE TABLE IF NOT EXISTS review_dimensions (
  key        TEXT PRIMARY KEY,                       -- d1, d2, d3, d4, d5
  label      TEXT  NOT NULL,                         -- 显示名称
  weight     FLOAT NOT NULL CHECK (weight > 0 AND weight <= 1),
  sort_order INT   NOT NULL DEFAULT 0
);

COMMENT ON TABLE review_dimensions IS '评审维度配置：维度名称、权重、排序';

-- 初始化 5 个评审维度
INSERT INTO review_dimensions (key, label, weight, sort_order) VALUES
  ('d1', '教育目标对齐度',         0.25, 1),
  ('d2', 'PBL方法论落实度',        0.25, 2),
  ('d3', '教育过程原则践行度',      0.25, 3),
  ('d4', '年龄适配度与内容质量',    0.15, 4),
  ('d5', '教案完整性与可操作性',    0.10, 5)
ON CONFLICT (key) DO NOTHING;


-- =============================================================
-- 5. reviews — 评审记录表
-- 多人可对同一课程独立评审
-- =============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  comment     TEXT,                                  -- 评语（可选）
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 防止同一评审人对同一课程重复评审
  UNIQUE (course_id, reviewer_id)
);

COMMENT ON TABLE reviews IS '课程评审记录，支持多人独立评审';

-- 索引
CREATE INDEX idx_reviews_course   ON reviews (course_id);
CREATE INDEX idx_reviews_reviewer ON reviews (reviewer_id);


-- =============================================================
-- 6. review_scores — 评审维度得分表
-- 每条评审包含 5 个维度的 A/B/C 评级
-- =============================================================
CREATE TABLE IF NOT EXISTS review_scores (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id     UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  dimension_key TEXT NOT NULL REFERENCES review_dimensions(key),
  grade         TEXT NOT NULL CHECK (grade IN ('A', 'B', 'C')),

  -- 每条评审中每个维度只能打一次分
  UNIQUE (review_id, dimension_key)
);

COMMENT ON TABLE  review_scores IS '评审维度得分：每条评审 × 每个维度 = 一个评级';
COMMENT ON COLUMN review_scores.grade IS '评级：A=优秀(3分), B=合格(2分), C=不合格(1分)';

-- 索引
CREATE INDEX idx_scores_review ON review_scores (review_id);


-- =============================================================
-- 7. 自动更新 updated_at 触发器
-- =============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- =============================================================
-- 8. Row Level Security (RLS) 策略
-- 正式上线后启用，开发阶段可先注释掉
-- =============================================================

-- 启用 RLS
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_steps   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_scores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_dimensions ENABLE ROW LEVEL SECURITY;

-- ---- users 策略 ----
-- 所有认证用户可查看用户信息
CREATE POLICY "users_select_authenticated"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- 用户只能修改自己的信息
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid());

-- ---- courses 策略 ----
-- 所有认证用户可查看课程
CREATE POLICY "courses_select_authenticated"
  ON courses FOR SELECT
  TO authenticated
  USING (true);

-- 教师和管理员可提交课程
CREATE POLICY "courses_insert_teacher"
  ON courses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.role IN ('teacher', 'admin')
    )
  );

-- 仅提交者本人或管理员可修改课程
CREATE POLICY "courses_update_owner_or_admin"
  ON courses FOR UPDATE
  TO authenticated
  USING (
    teacher_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );

-- ---- course_steps 策略 ----
-- 跟随课程权限：能看到课程就能看到步骤
CREATE POLICY "steps_select_authenticated"
  ON course_steps FOR SELECT
  TO authenticated
  USING (true);

-- 插入/修改跟随课程所有权
CREATE POLICY "steps_insert_course_owner"
  ON course_steps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses c
      JOIN users u ON u.id = c.teacher_id
      WHERE c.id = course_id
        AND u.auth_id = auth.uid()
    )
  );

-- ---- reviews 策略 ----
-- 所有认证用户可查看评审
CREATE POLICY "reviews_select_authenticated"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

-- 评审员和管理员可提交评审
CREATE POLICY "reviews_insert_reviewer"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.role IN ('reviewer', 'admin')
    )
  );

-- 仅评审人本人可删除自己的评审
CREATE POLICY "reviews_delete_own"
  ON reviews FOR DELETE
  TO authenticated
  USING (
    reviewer_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- ---- review_scores 策略 ----
-- 跟随评审权限
CREATE POLICY "scores_select_authenticated"
  ON review_scores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "scores_insert_review_owner"
  ON review_scores FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews r
      JOIN users u ON u.id = r.reviewer_id
      WHERE r.id = review_id
        AND u.auth_id = auth.uid()
    )
  );

-- ---- review_dimensions 策略 ----
-- 配置表：所有人可读，仅管理员可改
CREATE POLICY "dimensions_select_all"
  ON review_dimensions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "dimensions_modify_admin"
  ON review_dimensions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );


-- =============================================================
-- 9. 常用视图 — 课程评审汇总
-- 计算每门课程的综合评审结果
-- =============================================================
CREATE OR REPLACE VIEW course_review_summary AS
SELECT
  c.id AS course_id,
  c.name AS course_name,
  c.module,
  c.age_group,
  c.status,
  COUNT(DISTINCT r.id) AS review_count,
  -- 各维度平均分
  ROUND(AVG(CASE WHEN rs.dimension_key = 'd1' THEN
    CASE rs.grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END
  END)::numeric, 2) AS d1_avg,
  ROUND(AVG(CASE WHEN rs.dimension_key = 'd2' THEN
    CASE rs.grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END
  END)::numeric, 2) AS d2_avg,
  ROUND(AVG(CASE WHEN rs.dimension_key = 'd3' THEN
    CASE rs.grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END
  END)::numeric, 2) AS d3_avg,
  ROUND(AVG(CASE WHEN rs.dimension_key = 'd4' THEN
    CASE rs.grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END
  END)::numeric, 2) AS d4_avg,
  ROUND(AVG(CASE WHEN rs.dimension_key = 'd5' THEN
    CASE rs.grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END
  END)::numeric, 2) AS d5_avg,
  -- 加权总分（满分 3 分）
  ROUND((
    COALESCE(AVG(CASE WHEN rs.dimension_key = 'd1' THEN
      CASE rs.grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END END), 0) * 0.25 +
    COALESCE(AVG(CASE WHEN rs.dimension_key = 'd2' THEN
      CASE rs.grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END END), 0) * 0.25 +
    COALESCE(AVG(CASE WHEN rs.dimension_key = 'd3' THEN
      CASE rs.grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END END), 0) * 0.25 +
    COALESCE(AVG(CASE WHEN rs.dimension_key = 'd4' THEN
      CASE rs.grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END END), 0) * 0.15 +
    COALESCE(AVG(CASE WHEN rs.dimension_key = 'd5' THEN
      CASE rs.grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END END), 0) * 0.10
  )::numeric, 2) AS weighted_score
FROM courses c
LEFT JOIN reviews r ON r.course_id = c.id
LEFT JOIN review_scores rs ON rs.review_id = r.id
GROUP BY c.id, c.name, c.module, c.age_group, c.status;

COMMENT ON VIEW course_review_summary IS '课程评审汇总视图：各维度平均分 + 加权总分';


-- =============================================================
-- 完成
-- =============================================================
