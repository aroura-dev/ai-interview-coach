package com.mirror.agent.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** Detail of one finished interview: metadata + markdown report/review plan. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HistoryDetail {
    private String sessionId;
    private String position;
    private double overallScore;
    private LocalDateTime createdAt;
    private String report;
    private String reviewPlan;
    private java.util.List<EvaluationReport.QuestionReview> questions;
}
