package com.mirror.agent.agent;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

@Slf4j
@Component
@RequiredArgsConstructor
public class ChatAgent {

    private final ChatModel chatModel;

    /** 聊天历史上限：20 条消息（10 轮对话），与 Go 版本一致 */
    private static final int MAX_HISTORY_SIZE = 20;

    private static final String CHAT_AGENT_PROMPT = """
            你是 MirrorAgent 系统的智能助手，一个专注于技术面试的 AI 伙伴。

            你的能力范围：
            1. 回答技术面试相关的问题（面试技巧、知识点讲解、简历建议等）
            2. 帮助用户了解本系统的功能（模拟面试、评估报告、复习计划等）
            3. 日常技术问题的闲聊和答疑

            你的行为规范：
            - 友善专业，回答简洁有深度
            - 不要主动替用户做决定，保持引导式对话

            【重要：面试引导规则】
            当用户表达出想要面试的意图时（比如"开始面试"、"模拟面试"、"我想练习面试"、"怎么开始"、"怎么用"等），你必须引导用户点击页面底部的「开始面试」按钮。回复示例：

            "请点击页面底部的 **「开始面试」** 按钮来启动标准面试流程。点击后你可以：
            - 上传或粘贴 **岗位 JD**（支持链接、文件、文本）
            - 上传或粘贴你的 **简历**

            系统会自动完成 JD 分析、简历匹配度评估、智能出题、实时评分，最后生成完整的评估报告和个性化复习计划。"

            不要在聊天中直接启动面试流程，因为只有通过按钮才能进入包含 JD 分析、简历匹配、RAG 出题等完整环节的标准化面试。

            当前对话上下文中可能包含用户之前面试的历史信息，可以据此提供更个性化的建议。""";

    /** 文档结构化分析提示词：用户带文件 + 分析类意图时使用 */
    private static final String DOC_ANALYSIS_PROMPT = """
            你是 MirrorAgent 的文档分析助手。用户通过聊天上传了文件（内容以【文件 文件名】开头标注），并提出了分析类要求。

            严格遵守以下规则：
            1. 用「加粗小标题 + 要点列表」组织输出，不要使用表格；即使需要对照，也写成逐条要点，例如「- 要求：… → 现状：…（满足/有差距）」：
            2. 先给结论再展开；禁止空泛夸奖、禁止表情符号、禁止车轱辘话。
            3. 所有判断必须基于文件内容；信息不足时明确写「文件未提供该信息」，不要脑补。
            4. 先做事实性拆解，再给优势与风险，最后给可执行建议；整体精炼，要点用短句。

            推荐结构（小标题加粗 + 简洁要点）：
            **结论**
            - 2-4 条直给判断
            **关键信息**
            - 从文件提取的核心事实
            **对照 / 匹配**
            - 逐条要点：要求 → 现状 → 是否满足
            **优势**
            - 有依据的 1-3 条
            **不足 / 风险**
            - 1-3 条
            **建议**
            - 可执行的 1-3 条
            """;

    /** 判定是否为「带文档的分析类请求」的意图词 */
    private static final List<String> ANALYSIS_HINTS = List.of(
            "分析", "匹配", "对比", "评估", "评价", "拆解", "总结", "提炼", "归纳", "建议",
            "优劣势", "强弱项", "优势", "不足", "差距", "缺口", "适合", "匹配度",
            "岗位", "简历", "能力", "要求", "技术栈", "职责", "要点", "亮点", "面试",
            "怎么样", "如何", "看看", "读一下"
    );

    /** 文档分析模式：消息包含文件标注，且用户给出了分析类意图 */
    private boolean isDocAnalysisRequest(String userInput, String userIntent) {
        if (userInput == null || !userInput.contains("【文件 ")) return false;
        if (userIntent == null || userIntent.isBlank()) return false;
        String lower = userIntent.toLowerCase();
        return ANALYSIS_HINTS.stream().anyMatch(lower::contains);
    }

    /** 聊天：维护历史上下文，限制最近 20 条消息 */
    public String chat(List<Message> history, String userInput) {
        return chat(history, userInput, "");
    }

    public String chat(List<Message> history, String userInput, String userIntent) {
        boolean docMode = isDocAnalysisRequest(userInput, userIntent);

        List<Message> messages = new ArrayList<>();
        messages.add(new SystemMessage(docMode ? DOC_ANALYSIS_PROMPT : CHAT_AGENT_PROMPT));

        // 截取最近 20 条历史消息
        if (history != null && !history.isEmpty()) {
            int startIdx = Math.max(0, history.size() - MAX_HISTORY_SIZE);
            messages.addAll(history.subList(startIdx, history.size()));
        }

        messages.add(new UserMessage(userInput));

        ChatResponse response = chatModel.call(new Prompt(messages));
        return response.getResult().getOutput().getText();
    }

    /** 流式生成：逐 token 回调 onToken */
    public void stream(List<Message> history, String userInput, String userIntent, Consumer<String> onToken) {
        boolean docMode = isDocAnalysisRequest(userInput, userIntent);

        List<Message> messages = new ArrayList<>();
        messages.add(new SystemMessage(docMode ? DOC_ANALYSIS_PROMPT : CHAT_AGENT_PROMPT));

        if (history != null && !history.isEmpty()) {
            int startIdx = Math.max(0, history.size() - MAX_HISTORY_SIZE);
            messages.addAll(history.subList(startIdx, history.size()));
        }

        messages.add(new UserMessage(userInput));

        chatModel.stream(new Prompt(messages))
                .doOnNext(resp -> {
                    if (resp.getResult() != null) {
                        String text = resp.getResult().getOutput().getText();
                        if (text != null && !text.isEmpty()) onToken.accept(text);
                    }
                })
                .doOnError(e -> log.warn("[ChatAgent] 流式生成失败: {}", e.getMessage()))
                .blockLast();
    }
}
