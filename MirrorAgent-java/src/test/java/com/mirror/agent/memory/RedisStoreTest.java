package com.mirror.agent.memory;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RedisStoreTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Test
    @DisplayName("画像缓存写入必须带 TTL")
    void savesProfileWithTtl() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        RedisStore store = new RedisStore(redisTemplate);
        UserProfile profile = UserProfile.builder().userId("u1").name("tester").build();
        Duration ttl = Duration.ofMinutes(30);

        store.saveProfile(profile, ttl);

        verify(valueOperations).set(eq("mirror:profile:u1"), anyString(), eq(ttl));
    }
}
