package com.mirror.agent.controller;

import com.mirror.agent.auth.JwtService;
import com.mirror.agent.memory.MySQLStore;
import com.mirror.agent.model.HistoryDetail;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** History endpoints: list finished interviews and fetch report/review plan detail. */
@Slf4j
@RestController
@RequestMapping("/api/history")
@RequiredArgsConstructor
public class HistoryController {

    private final JwtService jwtService;
    private final MySQLStore mysqlStore;

    @GetMapping
    public ResponseEntity<?> list(@RequestHeader(value = "Authorization", required = false) String auth) {
        String user = resolveUser(auth);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "\u672a\u767b\u5f55\u6216\u767b\u5f55\u5df2\u8fc7\u671f"));
        }
        return ResponseEntity.ok(Map.of("items", mysqlStore.listInterviewRecords(user)));
    }

    @GetMapping("/question-reviews")
    public ResponseEntity<?> questionReviews(@RequestHeader(value = "Authorization", required = false) String auth) {
        String user = resolveUser(auth);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "\u672a\u767b\u5f55\u6216\u767b\u5f55\u5df2\u8fc7\u671f"));
        }
        return ResponseEntity.ok(Map.of("items", mysqlStore.listQuestionReviews(user)));
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<?> detail(@PathVariable String sessionId,
                                    @RequestHeader(value = "Authorization", required = false) String auth) {
        String user = resolveUser(auth);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "\u672a\u767b\u5f55\u6216\u767b\u5f55\u5df2\u8fc7\u671f"));
        }
        HistoryDetail detail = mysqlStore.getHistoryDetail(user, sessionId);
        if (detail == null) {
            return ResponseEntity.status(404).body(Map.of("error", "\u8bb0\u5f55\u4e0d\u5b58\u5728"));
        }
        return ResponseEntity.ok(detail);
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
