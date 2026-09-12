package com.mirror.agent.controller;

import com.mirror.agent.auth.JwtService;
import com.mirror.agent.memory.MySQLStore;
import com.mirror.agent.model.ReviewItem;
import com.mirror.agent.review.Sm2Scheduler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Spaced-repetition review queue endpoints (SM-2). */
@Slf4j
@RestController
@RequestMapping("/api/review")
@RequiredArgsConstructor
public class ReviewController {

    private final JwtService jwtService;
    private final MySQLStore mysqlStore;

    @GetMapping("/today")
    public ResponseEntity<?> today(@RequestHeader(value = "Authorization", required = false) String auth) {
        String user = resolveUser(auth);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "\u672a\u767b\u5f55\u6216\u767b\u5f55\u5df2\u8fc7\u671f"));
        }
        return ResponseEntity.ok(Map.of("items", mysqlStore.listDueReviewItems(user)));
    }

    @GetMapping("/items")
    public ResponseEntity<?> items(@RequestHeader(value = "Authorization", required = false) String auth) {
        String user = resolveUser(auth);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "\u672a\u767b\u5f55\u6216\u767b\u5f55\u5df2\u8fc7\u671f"));
        }
        return ResponseEntity.ok(Map.of("items", mysqlStore.listActiveReviewItems(user)));
    }

    @PostMapping("/import")
    public ResponseEntity<?> importItem(@RequestHeader(value = "Authorization", required = false) String auth,
                                        @RequestBody Map<String, Object> body) {
        String user = resolveUser(auth);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "\u672a\u767b\u5f55\u6216\u767b\u5f55\u5df2\u8fc7\u671f"));
        }
        Object content = body.get("content");
        if (content == null || String.valueOf(content).trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "\u5185\u5bb9\u4e0d\u80fd\u4e3a\u7a7a"));
        }
        String topic = String.valueOf(content).trim();
        if (topic.length() > 200) topic = topic.substring(0, 200);
        mysqlStore.syncReviewItem(user, topic, 0.0);
        return ResponseEntity.ok(Map.of("imported", true, "topic", topic));
    }

    @PostMapping("/grade")
    public ResponseEntity<?> grade(@RequestHeader(value = "Authorization", required = false) String auth,
                                   @RequestBody Map<String, Object> body) {
        String user = resolveUser(auth);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "\u672a\u767b\u5f55\u6216\u767b\u5f55\u5df2\u8fc7\u671f"));
        }
        Object topicObj = body.get("topic");
        Object qualityObj = body.get("quality");
        if (topicObj == null || qualityObj == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "\u53c2\u6570\u4e0d\u5b8c\u6574"));
        }
        int quality;
        try {
            quality = ((Number) qualityObj).intValue();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "quality \u5fc5\u987b\u662f\u6570\u5b57"));
        }
        ReviewItem item = mysqlStore.findReviewItem(user, String.valueOf(topicObj));
        if (item == null) {
            return ResponseEntity.status(404).body(Map.of("error", "\u8be5\u590d\u4e60\u9879\u4e0d\u5b58\u5728"));
        }
        Sm2Scheduler.Sm2Result r = Sm2Scheduler.schedule(quality, item.getEase(),
                item.getIntervalDays(), item.getReps());
        LocalDateTime due = LocalDateTime.now().plusDays(r.intervalDays());
        mysqlStore.updateReviewSchedule(user, item.getTopic(), r.ease(), r.intervalDays(), r.reps(), quality, due);
        item.setEase(r.ease());
        item.setIntervalDays(r.intervalDays());
        item.setReps(r.reps());
        item.setLastQuality(quality);
        item.setDueDate(due);
        return ResponseEntity.ok(item);
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
}
