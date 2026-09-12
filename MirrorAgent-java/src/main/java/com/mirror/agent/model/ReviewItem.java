package com.mirror.agent.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** One spaced-repetition review item per user + weak topic. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewItem {
    private Long id;
    private String userId;
    private String topic;
    private double ease;
    private int intervalDays;
    private int reps;
    private LocalDateTime dueDate;
    private int lastQuality;
    private String status;
    private LocalDateTime updatedAt;
}
