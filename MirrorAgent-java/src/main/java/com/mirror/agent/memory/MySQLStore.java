package com.mirror.agent.memory;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.mirror.agent.model.EvaluationReport;
import com.mirror.agent.model.HistoryDetail;
import com.mirror.agent.model.HistoryItem;
import com.mirror.agent.model.ProfileSnapshot;
import com.mirror.agent.model.ReviewItem;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * MySQL 存储层（与 Go 版本表结构一致）
 * 使用 JPA EntityManager 执行原生 SQL，确保表结构与 Go 版本完全对齐。
 */
@Slf4j
@Component
public class MySQLStore {

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    /**
     * 初始化建表（与 Go 版本一致，自动建表）。
     * Spring Data JPA 的 ddl-auto 只处理 @Entity 的 users 表；user_profiles / interview_records
     * 是用原生 SQL 操作的非实体表，必须在此显式建表。
     * 用 JdbcTemplate 执行 DDL（自带连接、自动提交），避免 @PostConstruct 上 @Transactional
     * 自调用代理不生效导致的 TransactionRequired 问题。
     */
    @PostConstruct
    public void migrate() {
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_profiles (
                    user_id VARCHAR(128) PRIMARY KEY,
                    name VARCHAR(256) DEFAULT '',
                    skill_level JSON,
                    weak_points JSON,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """);

            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS interview_records (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(128) NOT NULL,
                    session_id VARCHAR(128) NOT NULL UNIQUE,
                    position VARCHAR(256) DEFAULT '',
                    overall_score DOUBLE DEFAULT 0,
                    report_json MEDIUMTEXT,
                    review_plan_json MEDIUMTEXT,
                    report_md MEDIUMTEXT,
                    review_plan_md MEDIUMTEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    INDEX idx_session_id (session_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """);

            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS profile_snapshots (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(128) NOT NULL,
                    session_id VARCHAR(128) DEFAULT '',
                    weak_point_count INT DEFAULT 0,
                    avg_weak_score DOUBLE DEFAULT 0,
                    weak_points_json MEDIUMTEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    INDEX idx_created (user_id, created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """);

            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS review_items (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(128) NOT NULL,
                    topic VARCHAR(256) NOT NULL,
                    ease DOUBLE DEFAULT 2.5,
                    interval_days INT DEFAULT 0,
                    reps INT DEFAULT 0,
                    due_date DATETIME,
                    last_quality INT DEFAULT -1,
                    status VARCHAR(16) DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_user_topic (user_id, topic),
                    INDEX idx_due (user_id, status, due_date)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """);

                        ensureColumn("interview_records", "report_md", "ALTER TABLE interview_records ADD COLUMN report_md MEDIUMTEXT");
            ensureColumn("interview_records", "review_plan_md", "ALTER TABLE interview_records ADD COLUMN review_plan_md MEDIUMTEXT");
            ensureColumn("profile_snapshots", "weak_points_json", "ALTER TABLE profile_snapshots ADD COLUMN weak_points_json MEDIUMTEXT");

            log.info("[MySQLStore] 表结构就绪");
        } catch (Exception e) {
            log.warn("[MySQLStore] 建表异常（可能已存在）: {}", e.getMessage());
        }
    }

    private void ensureColumn(String table, String column, String alterSql) {
        try {
            Integer cnt = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
                            + "AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                    Integer.class, table, column);
            if (cnt == null || cnt == 0) {
                jdbcTemplate.execute(alterSql);
                log.info("[MySQLStore] added column {} on {}", column, table);
            }
        } catch (Exception e) {
            log.warn("[MySQLStore] ensure column {} failed (ignored): {}", column, e.getMessage());
        }
    }

    @Transactional
    public void saveProfile(UserProfile profile) {
        try {
            String skillLevelJson = objectMapper.writeValueAsString(profile.getSkillLevel());
            String weakPointsJson = objectMapper.writeValueAsString(profile.getWeakPoints());

            entityManager.createNativeQuery("""
                INSERT INTO user_profiles (user_id, name, skill_level, weak_points)
                VALUES (:userId, :name, :skillLevel, :weakPoints)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    skill_level = VALUES(skill_level),
                    weak_points = VALUES(weak_points),
                    updated_at = NOW()
            """)
            .setParameter("userId", profile.getUserId())
            .setParameter("name", profile.getName() != null ? profile.getName() : "")
            .setParameter("skillLevel", skillLevelJson)
            .setParameter("weakPoints", weakPointsJson)
            .executeUpdate();
        } catch (Exception e) {
            log.error("[MySQLStore] 保存 Profile 失败: {}", e.getMessage());
        }
    }

    public UserProfile loadProfile(String userId) {
        try {
            @SuppressWarnings("unchecked")
            List<Object[]> results = entityManager.createNativeQuery(
                "SELECT user_id, name, skill_level, weak_points FROM user_profiles WHERE user_id = :userId"
            ).setParameter("userId", userId).getResultList();

            if (results.isEmpty()) return null;

            Object[] row = results.get(0);
            UserProfile profile = new UserProfile();
            profile.setUserId((String) row[0]);
            profile.setName((String) row[1]);

            if (row[2] != null) {
                profile.setSkillLevel(objectMapper.readValue(row[2].toString(),
                        new TypeReference<Map<String, String>>() {}));
            }
            if (row[3] != null) {
                profile.setWeakPoints(objectMapper.readValue(row[3].toString(),
                        new TypeReference<List<UserProfile.WeakPoint>>() {}));
            }

            return profile;
        } catch (Exception e) {
            log.error("[MySQLStore] 加载 Profile 失败: {}", e.getMessage());
            return null;
        }
    }

    @Transactional
    public void saveInterviewRecord(String userId, UserProfile.InterviewRecord record,
                                     String reportJson, String reviewPlanJson,
                                     String reportMd, String reviewPlanMd) {
        try {
            entityManager.createNativeQuery("""
                INSERT INTO interview_records (user_id, session_id, position, overall_score, report_json, review_plan_json, report_md, review_plan_md)
                VALUES (:userId, :sessionId, :position, :score, :report, :reviewPlan, :reportMd, :reviewPlanMd)
            """)
            .setParameter("userId", userId)
            .setParameter("sessionId", record.getSessionId())
            .setParameter("position", record.getPosition())
            .setParameter("score", record.getOverallScore())
            .setParameter("report", reportJson)
            .setParameter("reviewPlan", reviewPlanJson)
            .setParameter("reportMd", reportMd)
            .setParameter("reviewPlanMd", reviewPlanMd)
            .executeUpdate();
        } catch (Exception e) {
            log.error("[MySQLStore] 保存面试记录失败: {}", e.getMessage());
        }
    }
    public List<Map<String, Object>> listQuestionReviews(String userId) {
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        try {
            jdbcTemplate.query(
                    "SELECT session_id, position, created_at, report_json FROM interview_records "
                            + "WHERE user_id = ? AND report_json IS NOT NULL ORDER BY created_at DESC LIMIT 100",
                    rs -> {
                        String json = rs.getString("report_json");
                        List<EvaluationReport.QuestionReview> qs = new java.util.ArrayList<>();
                        if (json != null && !json.isEmpty()) {
                            try {
                                EvaluationReport er = objectMapper.readValue(json, EvaluationReport.class);
                                if (er.getDetailedReview() != null) qs = er.getDetailedReview();
                            } catch (Exception ignore) { }
                        }
                        Map<String, Object> m = new java.util.LinkedHashMap<>();
                        m.put("sessionId", rs.getString("session_id"));
                        m.put("position", rs.getString("position"));
                        m.put("createdAt", rs.getTimestamp("created_at").toLocalDateTime());
                        m.put("questions", qs);
                        result.add(m);
                    },
                    userId);
        } catch (Exception e) {
            log.warn("[MySQLStore] 汇总逐题明细失败: {}", e.getMessage());
        }
        return result;
    }

    public List<HistoryItem> listInterviewRecords(String userId) {
        return jdbcTemplate.query(
                "SELECT session_id, position, overall_score, created_at FROM interview_records "
                        + "WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 200",
                (rs, rowNum) -> new HistoryItem(
                        rs.getString("session_id"),
                        rs.getString("position"),
                        rs.getDouble("overall_score"),
                        rs.getTimestamp("created_at").toLocalDateTime()),
                userId);
    }

    public HistoryDetail getHistoryDetail(String userId, String sessionId) {
        return jdbcTemplate.query(
                "SELECT session_id, position, overall_score, created_at, report_md, review_plan_md, "
                        + "report_json, review_plan_json FROM interview_records "
                        + "WHERE user_id = ? AND session_id = ? LIMIT 1",
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }
                    String report = rs.getString("report_md");
                    if (report == null || report.isEmpty()) {
                        String legacy = rs.getString("report_json");
                        report = (legacy == null || legacy.isEmpty()) ? "(no report content)" : "```json\n" + legacy + "\n```";
                    }
                    String plan = rs.getString("review_plan_md");
                    if (plan == null || plan.isEmpty()) {
                        String legacy = rs.getString("review_plan_json");
                        plan = (legacy == null || legacy.isEmpty()) ? "(no review plan)" : "```json\n" + legacy + "\n```";
                    }
                    java.util.List<EvaluationReport.QuestionReview> qs = new java.util.ArrayList<>();
                    String json = rs.getString("report_json");
                    if (json != null && !json.isEmpty()) {
                        try {
                            EvaluationReport er = objectMapper.readValue(json, EvaluationReport.class);
                            if (er.getDetailedReview() != null) qs = er.getDetailedReview();
                        } catch (Exception e) {
                            log.warn("[MySQLStore] 解析逐题明细失败: {}", e.getMessage());
                        }
                    }
                    return new HistoryDetail(
                            rs.getString("session_id"),
                            rs.getString("position"),
                            rs.getDouble("overall_score"),
                            rs.getTimestamp("created_at").toLocalDateTime(),
                            report,
                            plan,
                            qs);
                },
                userId, sessionId);
    }

    public void saveProfileSnapshot(String userId, String sessionId, int weakPointCount, double avgWeakScore,
                                     String weakPointsJson) {
        try {
            jdbcTemplate.update(
                    "INSERT INTO profile_snapshots (user_id, session_id, weak_point_count, avg_weak_score, weak_points_json) "
                            + "VALUES (?, ?, ?, ?, ?)",
                    userId, sessionId, weakPointCount, avgWeakScore, weakPointsJson);
        } catch (Exception e) {
            log.error("[MySQLStore] save profile snapshot failed: {}", e.getMessage());
        }
    }

    public List<ProfileSnapshot> listProfileSnapshots(String userId) {
        return jdbcTemplate.query(
                "SELECT session_id, weak_point_count, avg_weak_score, weak_points_json, created_at FROM profile_snapshots "
                        + "WHERE user_id = ? ORDER BY created_at ASC, id ASC",
                (rs, rowNum) -> new ProfileSnapshot(
                        rs.getString("session_id"),
                        rs.getInt("weak_point_count"),
                        rs.getDouble("avg_weak_score"),
                        rs.getString("weak_points_json"),
                        rs.getTimestamp("created_at").toLocalDateTime()),
                userId);
    }

    public void syncReviewItem(String userId, String topic, double score) {
        if (score >= 80) {
            jdbcTemplate.update(
                    "UPDATE review_items SET status = 'mastered', updated_at = NOW() WHERE user_id = ? AND topic = ?",
                    userId, topic);
            return;
        }
        Integer cnt = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM review_items WHERE user_id = ? AND topic = ?", Integer.class, userId, topic);
        if (cnt == null || cnt == 0) {
            jdbcTemplate.update(
                    "INSERT INTO review_items (user_id, topic, ease, interval_days, reps, due_date) "
                            + "VALUES (?, ?, 2.5, 0, 0, NOW())",
                    userId, topic);
        }
    }

    public ReviewItem findReviewItem(String userId, String topic) {
        List<ReviewItem> list = jdbcTemplate.query(
                "SELECT id, user_id, topic, ease, interval_days, reps, due_date, last_quality, status, updated_at "
                        + "FROM review_items WHERE user_id = ? AND topic = ? LIMIT 1",
                (rs, rowNum) -> reviewItemMapper(rs), userId, topic);
        return list.isEmpty() ? null : list.get(0);
    }

    public void updateReviewSchedule(String userId, String topic, double ease, int intervalDays, int reps,
                                     int quality, LocalDateTime due) {
        jdbcTemplate.update(
                "UPDATE review_items SET ease = ?, interval_days = ?, reps = ?, last_quality = ?, "
                        + "due_date = ?, updated_at = NOW() WHERE user_id = ? AND topic = ?",
                ease, intervalDays, reps, quality, due, userId, topic);
    }

    public List<ReviewItem> listDueReviewItems(String userId) {
        return jdbcTemplate.query(
                "SELECT id, user_id, topic, ease, interval_days, reps, due_date, last_quality, status, updated_at "
                        + "FROM review_items WHERE user_id = ? AND status = 'active' AND due_date <= NOW() "
                        + "ORDER BY due_date ASC LIMIT 100",
                (rs, rowNum) -> reviewItemMapper(rs), userId);
    }

    public List<ReviewItem> listActiveReviewItems(String userId) {
        return jdbcTemplate.query(
                "SELECT id, user_id, topic, ease, interval_days, reps, due_date, last_quality, status, updated_at "
                        + "FROM review_items WHERE user_id = ? AND status = 'active' ORDER BY due_date ASC LIMIT 300",
                (rs, rowNum) -> reviewItemMapper(rs), userId);
    }

    private com.mirror.agent.model.ReviewItem reviewItemMapper(java.sql.ResultSet rs) throws java.sql.SQLException {
        return ReviewItem.builder()
                .id(rs.getLong("id"))
                .userId(rs.getString("user_id"))
                .topic(rs.getString("topic"))
                .ease(rs.getDouble("ease"))
                .intervalDays(rs.getInt("interval_days"))
                .reps(rs.getInt("reps"))
                .dueDate(rs.getTimestamp("due_date") == null ? null : rs.getTimestamp("due_date").toLocalDateTime())
                .lastQuality(rs.getInt("last_quality"))
                .status(rs.getString("status"))
                .updatedAt(rs.getTimestamp("updated_at") == null ? null : rs.getTimestamp("updated_at").toLocalDateTime())
                .build();
    }

}
