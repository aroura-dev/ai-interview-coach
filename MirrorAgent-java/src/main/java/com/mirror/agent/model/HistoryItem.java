package com.mirror.agent.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** Summary row of one finished interview, shown in the history list. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HistoryItem {
    private String sessionId;
    private String position;
    private double overallScore;
    private LocalDateTime createdAt;
}
