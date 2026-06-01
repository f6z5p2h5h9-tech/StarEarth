-- =============================================================
-- StarEarth 星与土 · 本地开发环境初始化
-- 适用于本地 Docker PostgreSQL（不含 Supabase Auth 相关）
-- 
-- Supabase 正式上线时使用 001_init.sql（含 RLS 策略）
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- 1. users — 用户表
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id    UUID UNIQUE,
  name       TEXT NOT NULL,
  email      TEXT UNIQUE,
  role       TEXT NOT NULL DEFAULT 'teacher'
             CHECK (role IN ('teacher', 'reviewer', 'admin')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- =============================================================
-- 2. courses — 课程方案表
-- =============================================================
CREATE TABLE IF NOT EXISTS courses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name              TEXT NOT NULL,
  module            TEXT NOT NULL
                    CHECK (module IN ('STEAM', '人文与思辨', '玩耍与体育', '自然与生活')),
  age_group         TEXT NOT NULL
                    CHECK (age_group IN ('5-6岁', '6-8岁', '8-10岁', '10-12岁')),
  course_type       TEXT NOT NULL
                    CHECK (course_type IN ('常规课', '营地课', '户外研学')),
  duration          TEXT NOT NULL,
  ability           TEXT NOT NULL,
  alignment         TEXT NOT NULL,
  diff_from_school  TEXT NOT NULL,
  driving_question  TEXT NOT NULL,
  is_dual_track     BOOLEAN NOT NULL DEFAULT false,
  steam_knowledge   TEXT,
  steam_handson     TEXT,
  steam_solution    TEXT,
  hum_inquiry       TEXT,
  hum_discussion    TEXT,
  hum_resource      TEXT,
  convergence       TEXT,
  knowledge         TEXT,
  solution          TEXT,
  handson           TEXT,
  reflect           TEXT,
  materials         TEXT NOT NULL,
  safety            TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'passed', 'needs_revision', 'rejected')),
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_teacher   ON courses (teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_module    ON courses (module);
CREATE INDEX IF NOT EXISTS idx_courses_age_group ON courses (age_group);
CREATE INDEX IF NOT EXISTS idx_courses_status    ON courses (status);
CREATE INDEX IF NOT EXISTS idx_courses_submitted ON courses (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_module_age ON courses (module, age_group);

-- =============================================================
-- 3. course_steps — 教学流程步骤表
-- =============================================================
CREATE TABLE IF NOT EXISTS course_steps (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sort_order INT  NOT NULL DEFAULT 0,
  duration   TEXT NOT NULL,
  content    TEXT NOT NULL,
  UNIQUE (course_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_steps_course ON course_steps (course_id, sort_order);

-- =============================================================
-- 4. review_dimensions — 评审维度配置表
-- =============================================================
CREATE TABLE IF NOT EXISTS review_dimensions (
  key        TEXT PRIMARY KEY,
  label      TEXT  NOT NULL,
  weight     FLOAT NOT NULL CHECK (weight > 0 AND weight <= 1),
  sort_order INT   NOT NULL DEFAULT 0
);

INSERT INTO review_dimensions (key, label, weight, sort_order) VALUES
  ('d1', '教育目标对齐度',         0.25, 1),
  ('d2', 'PBL方法论落实度',        0.25, 2),
  ('d3', '教育过程原则践行度',      0.25, 3),
  ('d4', '年龄适配度与内容质量',    0.15, 4),
  ('d5', '教案完整性与可操作性',    0.10, 5)
ON CONFLICT (key) DO NOTHING;

-- =============================================================
-- 5. reviews — 评审记录表
-- =============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_course   ON reviews (course_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews (reviewer_id);

-- =============================================================
-- 6. review_scores — 评审维度得分表
-- =============================================================
CREATE TABLE IF NOT EXISTS review_scores (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id     UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  dimension_key TEXT NOT NULL REFERENCES review_dimensions(key),
  grade         TEXT NOT NULL CHECK (grade IN ('A', 'B', 'C')),
  UNIQUE (review_id, dimension_key)
);

CREATE INDEX IF NOT EXISTS idx_scores_review ON review_scores (review_id);

-- =============================================================
-- 7. updated_at 自动触发器
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
-- 8. 评审汇总视图
-- =============================================================
CREATE OR REPLACE VIEW course_review_summary AS
SELECT
  c.id AS course_id,
  c.name AS course_name,
  c.module,
  c.age_group,
  c.status,
  COUNT(DISTINCT r.id) AS review_count,
  ROUND(AVG(CASE WHEN rs.dimension_key = 'd1' THEN
    CASE rs.grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END END)::numeric, 2) AS d1_avg,
  ROUND(AVG(CASE WHEN rs.dimension_key = 'd2' THEN
    CASE rs.grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END END)::numeric, 2) AS d2_avg,
  ROUND(AVG(CASE WHEN rs.dimension_key = 'd3' THEN
    CASE rs.grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END END)::numeric, 2) AS d3_avg,
  ROUND(AVG(CASE WHEN rs.dimension_key = 'd4' THEN
    CASE rs.grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END END)::numeric, 2) AS d4_avg,
  ROUND(AVG(CASE WHEN rs.dimension_key = 'd5' THEN
    CASE rs.grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 END END)::numeric, 2) AS d5_avg,
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

-- =============================================================
-- 9. 插入测试用户（方便本地开发）
-- =============================================================
INSERT INTO users (name, email, role) VALUES
  ('陈老师', 'chen@starearth.cn', 'teacher'),
  ('李老师', 'li@starearth.cn', 'teacher'),
  ('王校长', 'wang@starearth.cn', 'admin'),
  ('张评审', 'zhang@starearth.cn', 'reviewer'),
  ('刘评审', 'liu@starearth.cn', 'reviewer')
ON CONFLICT (email) DO NOTHING;

-- =============================================================
-- ✅ 本地开发环境初始化完成
-- =============================================================
