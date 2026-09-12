package com.mirror.agent.memory;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * 组合存储：Redis 缓存 + MySQL 持久化（与 Go 版本一致）
 * - 写入：先写 MySQL（持久化），再写 Redis（缓存，失败不影响主流程）
 * - 读取：先读 Redis，miss 则读 MySQL 并回填 Redis
 */
@Slf4j
@Component
public class CombinedStore {

    /** 画像缓存 TTL，限制双写失败后的陈旧窗口 */
    private static final Duration PROFILE_CACHE_TTL = Duration.ofHours(2);

    private final RedisStore redisStore;
    private final MySQLStore mysqlStore;

    public CombinedStore(RedisStore redisStore, MySQLStore mysqlStore) {
        this.redisStore = redisStore;
        this.mysqlStore = mysqlStore;
    }

    /**
     * 双写：先 MySQL 后 Redis
     */
    public void saveProfile(UserProfile profile) {
        // 写 MySQL（持久化）
        mysqlStore.saveProfile(profile);
        // 写 Redis（缓存，失败不影响主流程）
        try {
            redisStore.saveProfile(profile, PROFILE_CACHE_TTL);
        } catch (Exception e) {
            log.warn("[CombinedStore] Redis 写入 profile 失败（不影响主流程）: {}", e.getMessage());
            try {
                redisStore.deleteProfile(profile.getUserId());
            } catch (Exception ignored) {
                log.warn("[CombinedStore] Redis 清理陈旧 profile 失败: {}", ignored.getMessage());
            }
        }
    }

    /**
     * 先读 Redis，miss 则读 MySQL 并回填 Redis
     */
    public UserProfile loadProfile(String userId) {
        // 先读 Redis
        UserProfile profile = redisStore.loadProfile(userId);
        if (profile != null) {
            return profile;
        }

        // Redis miss，读 MySQL
        profile = mysqlStore.loadProfile(userId);
        if (profile == null) {
            return null;
        }

        // 回填 Redis
        try {
            redisStore.saveProfile(profile, PROFILE_CACHE_TTL);
        } catch (Exception e) {
            log.warn("[CombinedStore] Redis 回填 profile 失败: {}", e.getMessage());
        }

        return profile;
    }

    /**
     * 双写 Session
     */
    public void saveSession(String sessionId, String data, Duration ttl) {
        redisStore.saveSession(sessionId, data, ttl);
    }

    /**
     * 先 Redis 后 MySQL（Session 主要存 Redis）
     */
    public String loadSession(String sessionId) {
        return redisStore.loadSession(sessionId);
    }

    /**
     * 获取底层 MySQL 存储（用于保存面试记录等扩展操作）
     */
    public MySQLStore getMySQLStore() {
        return mysqlStore;
    }

    /**
     * 获取底层 Redis 存储（用于文件 hash 等操作）
     */
    public RedisStore getRedisStore() {
        return redisStore;
    }
}
