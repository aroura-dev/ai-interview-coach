package com.mirror.agent.rag.eval;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mirror.agent.rag.BM25Retriever;
import com.mirror.agent.rag.RagDocument;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Offline BM25 retrieval regression baseline + dataset-quality diagnostics.
 *
 * <p>The golden set has two subsets:
 * <ul>
 *   <li>lexical (mode is null/"lexical"): queries nearly verbatim to seed docs; BM25 is
 *       expected to retrieve them, so they gate the pure-BM25 leg in CI.</li>
 *   <li>semantic (mode = "semantic"): paraphrased / multi-relevant / cross-topic queries
 *       that the naive punctuation-split BM25 cannot match (no Chinese word segmentation);
 *       these are meant for the online vector+rerank eval and are reported, not gated.</li>
 * </ul>
 *
 * <p>Run from the MirrorAgent-java module root (mvn test default working dir).
 */
class OfflineBm25BaselineTest {

    private static final Path DATA_DIR = Paths.get("data", "eval");
    private static final Path REPORT_DIR = DATA_DIR.resolve("reports");
    private static final int BM25_TOP_K = 20;

    /** "参考答案：" in unicode escapes to keep this source file pure ASCII. */
    private static final String REF_ANSWER_PREFIX = "\u53C2\u8003\u7B54\u6848\uFF1A";

    private static final class Agg {
        int n;
        double r1, r10, r20, mrr, ndcg10;
        int trivial;
    }

    @Test
    @DisplayName("Offline BM25 lexical-subset baseline meets quality gates")
    void bm25OfflineBaselineMeetsQualityGate() throws Exception {
        Path manifestPath = DATA_DIR.resolve("manifest.json");
        Path datasetPath = DATA_DIR.resolve("dataset_v1.json");
        assertTrue(Files.exists(manifestPath),
                "data/eval/manifest.json not found; run mvn test from MirrorAgent-java module root");
        assertTrue(Files.exists(datasetPath),
                "data/eval/dataset_v1.json not found; run mvn test from MirrorAgent-java module root");

        ObjectMapper mapper = new ObjectMapper();
        ManifestEntry[] entries = mapper.readValue(manifestPath.toFile(), ManifestEntry[].class);
        EvalSample[] samples = mapper.readValue(datasetPath.toFile(), EvalSample[].class);
        assertTrue(entries.length > 0, "manifest.json is empty");
        assertTrue(samples.length > 0, "dataset_v1.json is empty");

        // Index content identical to the online import flow: content + "\n参考答案：" + reference.
        List<RagDocument> docs = new ArrayList<>();
        Map<String, String> idToContent = new LinkedHashMap<>();
        for (ManifestEntry e : entries) {
            if (e.getId() == null || e.getContent() == null) {
                continue;
            }
            String content = e.getContent();
            if (e.getReference() != null && !e.getReference().isEmpty()) {
                content += "\n" + REF_ANSWER_PREFIX + e.getReference();
            }
            docs.add(RagDocument.builder().id(e.getId()).content(content).build());
            idToContent.put(e.getId(), content);
        }
        BM25Retriever retriever = new BM25Retriever(BM25_TOP_K);
        retriever.indexDocuments(docs);

        List<EvalSample> lexical = new ArrayList<>();
        List<EvalSample> semantic = new ArrayList<>();
        for (EvalSample s : samples) {
            if ("semantic".equals(s.getMode())) {
                semantic.add(s);
            } else {
                lexical.add(s);
            }
        }
        assertTrue(!lexical.isEmpty(), "no lexical samples for BM25 gate");

        Agg lexAgg = new Agg();
        List<String> lexRows = new ArrayList<>();
        for (EvalSample s : lexical) {
            evaluateOne(retriever, idToContent, s, lexAgg, lexRows);
        }
        Agg semAgg = new Agg();
        List<String> semRows = new ArrayList<>();
        for (EvalSample s : semantic) {
            evaluateOne(retriever, idToContent, s, semAgg, semRows);
        }

        writeReport(docs.size(), lexical, semantic, lexAgg, semAgg, lexRows, semRows);

        double avgR10 = lexAgg.r10 / lexAgg.n;
        double avgMrr = lexAgg.mrr / lexAgg.n;
        double avgNdcg10 = lexAgg.ndcg10 / lexAgg.n;
        double lexTrivial = (double) lexAgg.trivial / lexAgg.n;

        System.out.printf("OFFLINE_BM25_LEXICAL eval=%d Recall@10=%.4f MRR=%.4f nDCG@10=%.4f trivial=%d/%d (%.1f%%)%n",
                lexAgg.n, avgR10, avgMrr, avgNdcg10, lexAgg.trivial, lexAgg.n, lexTrivial * 100);
        if (semAgg.n > 0) {
            System.out.printf("OFFLINE_BM25_SEMANTIC eval=%d Recall@10=%.4f MRR=%.4f nDCG@10=%.4f "
                            + "(informational: paraphrase set for online vector eval, not a BM25 gate)%n",
                    semAgg.n, semAgg.r10 / semAgg.n, semAgg.mrr / semAgg.n, semAgg.ndcg10 / semAgg.n);
        }

        // Quality gates pinned from the 2026-09-07 measured lexical baseline
        // (Recall@10=0.5733, MRR=1.0000, nDCG@10=0.6368) with margin to catch regressions.
        assertTrue(avgR10 >= 0.50, () -> String.format("lexical Recall@10 below gate: %.4f", avgR10));
        assertTrue(avgMrr >= 0.90, () -> String.format("lexical MRR below gate: %.4f", avgMrr));
        assertTrue(avgNdcg10 >= 0.55, () -> String.format("lexical nDCG@10 below gate: %.4f", avgNdcg10));
    }

    private static void evaluateOne(BM25Retriever retriever, Map<String, String> idToContent,
                                    EvalSample s, Agg agg, List<String> rows) {
        List<String> rel = s.getRelevantDocIds() == null ? List.of() : s.getRelevantDocIds();
        if (rel.isEmpty()) {
            return;
        }
        List<String> retrieved = new ArrayList<>();
        for (RagDocument d : retriever.retrieve(s.getQuery())) {
            retrieved.add(d.getId());
        }
        double r1 = EvalMetrics.calcRecallAtK(retrieved, rel, 1);
        double r10 = EvalMetrics.calcRecallAtK(retrieved, rel, 10);
        double r20 = EvalMetrics.calcRecallAtK(retrieved, rel, 20);
        double mrr = EvalMetrics.calcMRR(retrieved, rel);
        double ndcg10 = EvalMetrics.calcNDCGAtK(retrieved, rel, 10);
        agg.n++;
        agg.r1 += r1;
        agg.r10 += r10;
        agg.r20 += r20;
        agg.mrr += mrr;
        agg.ndcg10 += ndcg10;

        String queryTrim = s.getQuery() == null ? "" : s.getQuery().trim();
        if (!retrieved.isEmpty() && !queryTrim.isEmpty()) {
            String topContent = idToContent.get(retrieved.get(0));
            if (topContent != null && topContent.contains(queryTrim)) {
                agg.trivial++;
            }
        }

        String mode = s.getMode() == null ? "lexical" : s.getMode();
        rows.add(String.format("| %s | %s | %s | %s | %s | %.3f | %.3f | %.3f | %.3f | %.3f |",
                s.getId(), mode, nz(s.getTopic()), nz(s.getDifficulty()),
                escapePipe(nz(s.getQuery())), r1, r10, r20, mrr, ndcg10));
    }

    private static void writeReport(int docCount,
                                    List<EvalSample> lexical, List<EvalSample> semantic,
                                    Agg lex, Agg sem, List<String> lexRows, List<String> semRows) {
        StringBuilder md = new StringBuilder();
        md.append("# Offline BM25 Retrieval Baseline\n\n");
        md.append("- Generated: ")
                .append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")))
                .append("\n");
        md.append("- Run via `mvn test` (no DashScope / Milvus / Redis required)\n");
        md.append("- Corpus: manifest.json, ").append(docCount).append(" questions\n");
        md.append("- Golden set: dataset_v1.json, ").append(lex.n + sem.n)
                .append(" valid samples (").append(lex.n).append(" lexical + ").append(sem.n).append(" semantic)\n");
        md.append("- BM25 params: k1=1.5, b=0.75, topK=").append(BM25_TOP_K).append("\n\n");

        md.append("## Lexical subset (BM25 regression gate)\n\n| Metric | Value |\n|---|---|\n");
        md.append(String.format("| Recall@1 | %.4f |\n", lex.r1 / lex.n));
        md.append(String.format("| Recall@10 | %.4f |\n", lex.r10 / lex.n));
        md.append(String.format("| Recall@20 | %.4f |\n", lex.r20 / lex.n));
        md.append(String.format("| MRR | %.4f |\n", lex.mrr / lex.n));
        md.append(String.format("| nDCG@10 | %.4f |\n\n", lex.ndcg10 / lex.n));

        md.append("## Dataset diagnostics\n\n");
        md.append(String.format("| subset | n | trivial top-1 hits | meaning |\n|---|---|---|---|\n"));
        md.append(String.format("| lexical | %d | %d/%d (%.1f%%) | top-1 doc contains the query verbatim "
                        + "(auto-generated from seed doc) |\n",
                lex.n, lex.trivial, lex.n, (double) lex.trivial / lex.n * 100));
        md.append(String.format("| semantic | %d | %d/%d (%.1f%%) | paraphrased queries; "
                        + "BM25 (no Chinese segmentation) under-retrieves them by design |\n",
                sem.n, sem.trivial, sem.n, sem.n == 0 ? 0 : (double) sem.trivial / sem.n * 100));
        md.append("> Lexical MRR is inflated by dataset construction (trivial hits); the semantic subset "
                + "exists to make MRR/nDCG discriminating in the online vector+rerank eval.\n\n");

        if (sem.n > 0) {
            md.append("## Semantic subset (informational, online eval target)\n\n| Metric | Value |\n|---|---|\n");
            md.append(String.format("| BM25-only Recall@1 | %.4f |\n", sem.r1 / sem.n));
            md.append(String.format("| BM25-only Recall@10 | %.4f |\n", sem.r10 / sem.n));
            md.append(String.format("| BM25-only MRR | %.4f |\n", sem.mrr / sem.n));
            md.append(String.format("| BM25-only nDCG@10 | %.4f |\n\n", sem.ndcg10 / sem.n));
            md.append("> These numbers are expected to be low: the semantic set requires vector recall + "
                    + "rerank (Milvus + Cross-Encoder). Run the online eval (`mvn spring-boot:run "
                    + "-Dspring-boot.run.arguments=\"eval --note semantic-v1\"`) to get the real hybrid numbers.\n\n");
        }

        md.append("## Lexical per-sample detail\n\n");
        md.append("| sample | mode | topic | difficulty | query | Recall@1 | Recall@10 | Recall@20 | MRR | nDCG@10 |\n");
        md.append("|---|---|---|---|---|---|---|---|---|---|\n");
        lexRows.forEach(r -> md.append(r).append("\n"));

        if (!semRows.isEmpty()) {
            md.append("\n## Semantic per-sample detail\n\n");
            md.append("| sample | mode | topic | difficulty | query | Recall@1 | Recall@10 | Recall@20 | MRR | nDCG@10 |\n");
            md.append("|---|---|---|---|---|---|---|---|---|---|\n");
            semRows.forEach(r -> md.append(r).append("\n"));
        }

        try {
            Files.createDirectories(REPORT_DIR);
            Files.writeString(REPORT_DIR.resolve("offline_bm25_baseline.md"), md.toString(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            System.err.println("[OfflineBm25BaselineTest] report write failed (ignored): " + e.getMessage());
        }
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String escapePipe(String s) {
        return s.replace("|", "\\|").replace("\n", " ");
    }
}