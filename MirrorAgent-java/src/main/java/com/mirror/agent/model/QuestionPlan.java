package com.mirror.agent.model;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class QuestionPlan {

    @JsonProperty("total_questions")
    private int totalQuestions;

    private QuestionDistrib distribution;
    private List<PlannedQuestion> questions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class QuestionDistrib {
        private int basic;
        private int experience;
        private int design;
    }
}
