package com.mirror.agent.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** One profile snapshot taken right after an interview ended. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProfileSnapshot {
    private String sessionId;
    private int weakPointCount;
    private double avgWeakScore;
    private String weakPointsJson;
    private LocalDateTime createdAt;
}
