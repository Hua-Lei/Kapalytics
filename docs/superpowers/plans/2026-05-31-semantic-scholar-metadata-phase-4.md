# Semantic Scholar Metadata Enrichment Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Enhance paper quality signals with Semantic Scholar enriched metadata: influential citations, improved venue, fields of study, and reference counts, without breaking the existing flow when the API is unavailable.

**Architecture:** Create a metadata enrichment adapter that batch-fetches from Semantic Scholar's `/paper/batch` endpoint, caches results in memory for the session, and feeds enriched fields into the existing `PaperQualityAnnotator`. The enricher is optional — if it fails, quality scores degrade gracefully to the current Phase 1-3 behavior.

**Tech Stack:** Electron main process, TypeScript, `undici` for HTTP, `node:assert/strict` tests.

---

## File Structure

- Create `src/main/retrieval/metadataEnricher.ts` — batch fetch, cache, enrich candidates.
- Create `src/main/retrieval/metadataEnricher.test.ts` — unit tests.
- Modify `src/main/kg4/paperQuality.ts` — accept enriched metadata, use `influentialCitationCount` and better venue.
- Modify `src/main/index.ts` — enrich before quality annotation.
- Modify `src/main/kg4/paperQuality.test.ts` — test enriched signals.

---

## Task 1: Create Metadata Enricher

Semantic Scholar batch endpoint: `POST https://api.semanticscholar.org/graph/v1/paper/batch`

Request body: `{ "ids": ["paperId1", "paperId2", ...] }`

Available fields: `paperId,corpusId,title,year,venue,publicationVenue,citationCount,influentialCitationCount,referenceCount,fieldsOfStudy,s2FieldsOfStudy,publicationDate,journal,authors,externalIds,url,isOpenAccess,openAccessPdf,tldr`

Create `src/main/retrieval/metadataEnricher.ts`:
- Export `enrichCandidatesWithSemanticScholar(candidates, options?)` that batch-fetches metadata for papers with Semantic Scholar IDs.
- Session-level in-memory cache: `Map<string, EnrichedMetadata>`.
- Handle API errors gracefully — return partial results, never throw.
- Rate-limit awareness: wait between batches.

Create `src/main/retrieval/metadataEnricher.test.ts`:
- Test that papers with Semantic Scholar IDs get enriched.
- Test that cache avoids repeat fetches.
- Test graceful degradation when API fails.

Run tests, commit `feat(retrieval): add Semantic Scholar metadata enricher`.

## Task 2: Integrate Into Quality And Flow

Modify `src/main/kg4/paperQuality.ts`:
- Add optional `EnrichedMetadata` input parameter.
- Use `influentialCitationCount` as additional quality boost.
- Use `s2FieldsOfStudy` to improve category-specific venue matching.
- Use `publicationVenue` name if the existing venue is missing.

Modify `src/main/index.ts`:
- After retrieval and before quality annotation, call `enrichCandidatesWithSemanticScholar(candidates)`.
- Pass enriched metadata into `annotatePaperQuality`.

Modify `src/main/kg4/paperQuality.test.ts`:
- Add test for influential citation boost.
- Add test for improved venue via S2 metadata.

Run tests, commit, final verification.
