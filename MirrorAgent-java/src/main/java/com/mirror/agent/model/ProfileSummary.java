package com.mirror.agent.model;

import com.mirror.agent.memory.UserProfile;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Aggregated learning statistics for one user (score trend + weak points + skill levels). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProfileSummary {
    private int interviewCount;
    private double avgScore;
    private double bestScore;
    private double latestScore;
    /** latest - earliest overall score; positive means improving. */
    private double scoreDelta;
    private String latestPosition;
    private LocalDateTime latestAt;
    private List<HistoryItem> series;
    private List<UserProfile.WeakPoint> weakPoints;
    private Map<String, String> skillLevel;
    private List<ProfileSnapshot> snapshots;
}
