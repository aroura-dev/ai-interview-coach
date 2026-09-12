package com.mirror.agent.review;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class Sm2SchedulerTest {

    @Test
    @DisplayName("first easy pass -> reps 1, interval 1, ease up")
    void firstEasyPass() {
        Sm2Scheduler.Sm2Result r = Sm2Scheduler.schedule(5, 2.5, 0, 0);
        assertEquals(1, r.reps());
        assertEquals(1, r.intervalDays());
        assertTrue(r.ease() > 2.5);
    }

    @Test
    @DisplayName("second pass -> interval 6")
    void secondPass() {
        Sm2Scheduler.Sm2Result r = Sm2Scheduler.schedule(4, 2.6, 1, 1);
        assertEquals(2, r.reps());
        assertEquals(6, r.intervalDays());
    }

    @Test
    @DisplayName("failure resets reps and shortens interval, ease floored at 1.3")
    void failureResets() {
        Sm2Scheduler.Sm2Result r = Sm2Scheduler.schedule(1, 1.3, 6, 5);
        assertEquals(0, r.reps());
        assertEquals(1, r.intervalDays());
        assertTrue(r.ease() >= 1.3);
    }

    @Test
    @DisplayName("quality clamped into 0..5")
    void clamp() {
        Sm2Scheduler.Sm2Result low = Sm2Scheduler.schedule(-3, 2.5, 0, 0);
        assertEquals(0, low.quality());
        Sm2Scheduler.Sm2Result high = Sm2Scheduler.schedule(9, 2.5, 0, 0);
        assertEquals(5, high.quality());
    }
}