package com.mirror.agent.controller;

import com.mirror.agent.auth.JwtService;
import com.mirror.agent.memory.MySQLStore;
import com.mirror.agent.memory.UserProfile;
import com.mirror.agent.model.HistoryItem;
import com.mirror.agent.model.ProfileSummary;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/** Profile summary endpoint: score trend, weak points and skill levels. */
@Slf4j
@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final JwtService jwtService;
    private final MySQLStore mysqlStore;

    @GetMapping("/summary")
    public ResponseEntity<?> summary(@RequestHeader(value = "Authorization", required = false) String auth) {
        String user = resolveUser(auth);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "\u672a\u767b\u5f55\u6216\u767b\u5f55\u5df2\u8fc7\u671f"));
        }
        List<HistoryItem> items = mysqlStore.listInterviewRecords(user);
        UserProfile profile = mysqlStore.loadProfile(user);

        ProfileSummary summary = new ProfileSummary();
        summary.setInterviewCount(items.size());
        summary.setSeries(items);
        summary.setWeakPoints(profile != null && profile.getWeakPoints() != null
                ? profile.getWeakPoints() : Collections.emptyList());
        summary.setSnapshots(mysqlStore.listProfileSnapshots(user));
        Map<String, String> levels = profile != null && profile.getSkillLevel() != null
                ? new java.util.LinkedHashMap<>(profile.getSkillLevel()) : new java.util.LinkedHashMap<>();
        if (levels.isEmpty() && profile != null && profile.getWeakPoints() != null) {
            int limit = 0;
            for (UserProfile.WeakPoint wp : profile.getWeakPoints()) {
                if (wp.getTopic() == null || limit >= 12) continue;
                levels.put(wp.getTopic(), wp.getScore() >= 50 ? "intermediate" : "beginner");
                limit++;
            }
        }
        summary.setSkillLevel(levels);

        if (!items.isEmpty()) {
            double sum = 0;
            double best = Double.MIN_VALUE;
            for (HistoryItem it : items) {
                sum += it.getOverallScore();
                best = Math.max(best, it.getOverallScore());
            }
            HistoryItem newest = items.get(0);   // list is newest-first
            HistoryItem oldest = items.get(items.size() - 1);
            summary.setAvgScore(round1(sum / items.size()));
            summary.setBestScore(round1(best));
            summary.setLatestScore(round1(newest.getOverallScore()));
            summary.setLatestPosition(newest.getPosition());
            summary.setLatestAt(newest.getCreatedAt());
            summary.setScoreDelta(round1(newest.getOverallScore() - oldest.getOverallScore()));
        }
        return ResponseEntity.ok(summary);
    }

    private String resolveUser(String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) {
            return null;
        }
        try {
            return jwtService.validateToken(auth.substring(7));
        } catch (Exception e) {
            return null;
        }
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }
}
