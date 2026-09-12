package com.mirror.agent.memory;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CombinedStoreTest {

    private static final Duration TTL = Duration.ofHours(2);

    @Mock
    private RedisStore redisStore;

    @Mock
    private MySQLStore mysqlStore;

    @InjectMocks
    private CombinedStore combinedStore;

    private UserProfile profile() {
        return UserProfile.builder().userId("u1").name("tester").build();
    }

    @Test
    @DisplayName("写入顺序为 MySQL 后再写带 TTL 的 Redis")
    void writesMySQLBeforeRedis() {
        UserProfile profile = profile();
        combinedStore.saveProfile(profile);

        InOrder order = inOrder(mysqlStore, redisStore);
        order.verify(mysqlStore).saveProfile(profile);
        order.verify(redisStore).saveProfile(profile, TTL);
    }

    @Test
    @DisplayName("Redis 写失败不阻断主流程，并尽力清理陈旧缓存")
    void redisWriteFailureDoesNotBreakMainFlow() {
        UserProfile profile = profile();
        doThrow(new IllegalStateException("redis down"))
                .when(redisStore).saveProfile(profile, TTL);

        assertDoesNotThrow(() -> combinedStore.saveProfile(profile));
        verify(redisStore).deleteProfile("u1");
    }

    @Test
    @DisplayName("Redis 命中时不再访问 MySQL")
    void cacheHitSkipsMySQL() {
        UserProfile profile = profile();
        when(redisStore.loadProfile("u1")).thenReturn(profile);

        assertSame(profile, combinedStore.loadProfile("u1"));
        verifyNoInteractions(mysqlStore);
    }

    @Test
    @DisplayName("Redis miss 时回源 MySQL 并带 TTL 回填")
    void cacheMissBackfillsRedis() {
        UserProfile profile = profile();
        when(redisStore.loadProfile("u1")).thenReturn(null);
        when(mysqlStore.loadProfile("u1")).thenReturn(profile);

        assertSame(profile, combinedStore.loadProfile("u1"));
        verify(redisStore).saveProfile(profile, TTL);
    }

    @Test
    @DisplayName("回填 Redis 失败时仍返回 MySQL 中的画像")
    void backfillFailureStillReturnsProfile() {
        UserProfile profile = profile();
        when(redisStore.loadProfile("u1")).thenReturn(null);
        when(mysqlStore.loadProfile("u1")).thenReturn(profile);
        doThrow(new IllegalStateException("redis down"))
                .when(redisStore).saveProfile(profile, TTL);

        assertSame(profile, combinedStore.loadProfile("u1"));
    }
}
