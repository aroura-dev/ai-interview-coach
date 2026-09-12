# MirrorAgent 工程证据映射

> 本文把项目描述映射到公开代码、测试和 CI 证据。公开仓库采用整理后的发布历史，不提供逐步开发过程。

## 1. 业务接口

| 业务模块 | 公开入口 | 已实现能力 |
|---|---|---|
| 用户认证 | `MirrorAgent-java/src/main/java/com/mirror/agent/auth/AuthController.java` | 注册、登录、JWT 身份校验 |
| 能力画像 | `MirrorAgent-java/src/main/java/com/mirror/agent/controller/ProfileController.java` | 当前用户画像摘要查询 |
| 面试历史 | `MirrorAgent-java/src/main/java/com/mirror/agent/controller/HistoryController.java` | 历史列表、会话详情、题目复盘 |
| 复习计划 | `MirrorAgent-java/src/main/java/com/mirror/agent/controller/ReviewController.java` | 今日复习、复习项查询、导入和评分 |

## 2. 数据一致性与用户隔离

- `MySQLStore#saveProfile` 使用 `@Transactional` 保存长期画像。
- `MySQLStore#saveInterviewRecord` 使用 `@Transactional` 保存面试记录与报告。
- 画像默认先写 MySQL，再更新 Redis；Redis 写失败时清理陈旧缓存且不阻断主流程。
- Redis 未命中时回源 MySQL 并回填，画像缓存 TTL 为 2 小时。
- 画像、会话和题库查询均按 `userId` 限制数据范围。

## 3. Agent 编排与检索

- `StateGraph` 编排 JD 分析、简历匹配、出题、面试、评估和复习流程。
- 检索链路包含 Milvus 向量召回、BM25 关键词召回、去重、重排和 RRF 融合。
- WebSocket 每路使用独立阻塞队列和线程池，隔离多会话任务。
- 模型异常或低置信度场景具有模板降级与人工复盘路径。

## 4. 测试与 CI

- CI：`.github/workflows/ci.yml`
- 后端测试：`cd MirrorAgent-java && mvn -B -ntp test`
- 前端 Vitest：4/4 通过。
- 前端检查：`cd MirrorAgent-web && npm ci && npm test && npm run lint && npm run build`
- 基础设施配置：`docker compose -f MirrorAgent-java/docker-compose.yml config --quiet`
- Docker 镜像：CI 会分别构建后端和前端镜像，验证多阶段 Dockerfile。
- 完整启动：`docker compose --profile app up -d --build --wait` 会启动基础设施、后端和 Nginx 前端。
- 健康检查：`/health` 提供存活探针，`/actuator/health` 汇总数据库与 Redis 状态。
- 离线检索报告：`MirrorAgent-java/data/eval/reports/`。

## 5. 数据边界

- RAG 指标来自小规模人工标注集，属于离线评测，不代表线上效果。
- MRR 受候选集和样本规模影响，不作为主要效果指标。
- 当前未覆盖生产流量、多实例并发、长时间稳定性及真实模型成本。