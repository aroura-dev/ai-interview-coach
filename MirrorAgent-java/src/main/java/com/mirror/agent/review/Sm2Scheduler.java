package com.mirror.agent.review;

/**
 * SM-2 spaced-repetition scheduler (pure function, unit-testable).
 * Standard algorithm: grade quality in 0..5.
 */
public final class Sm2Scheduler {

    public record Sm2Result(double ease, int intervalDays, int reps, int quality) {
    }

    private Sm2Scheduler() {
    }

    public static Sm2Result schedule(int quality, double ease, int intervalDays, int reps) {
        int q = Math.max(0, Math.min(5, quality));
        double e = Double.isNaN(ease) || ease < 1.3 ? 1.3 : ease;
        if (q >= 3) {
            int nextReps = reps + 1;
            int interval;
            if (nextReps == 1) {
                interval = 1;
            } else if (nextReps == 2) {
                interval = 6;
            } else {
                interval = Math.max(1, (int) Math.round(intervalDays * e));
            }
            e = e + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
            if (e < 1.3) {
                e = 1.3;
            }
            return new Sm2Result(e, interval, nextReps, q);
        }
        e = Math.max(1.3, e - 0.2);
        return new Sm2Result(e, 1, 0, q);
    }
}
