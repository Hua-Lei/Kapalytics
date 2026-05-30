import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { FilePaperMemoryRepository, SqlitePaperMemoryRepository } from './kg3Repository.js'
import type { Kg3MemorySnapshot } from '../../shared/kg3'
import type { Kg4NodeExpansionRecord } from '../../shared/kg4'

function createSnapshot(): Kg3MemorySnapshot {
  return {
    papers: [],
    paperInsights: [],
    graphNodes: [],
    graphEdges: [],
    readingSessions: [],
    learningTasks: [],
    diagnoses: [],
    nodeExpansions: [],
    paperSearchResults: [],
    mergedGraphNodes: [],
    mergedGraphEdges: [],
    userMastery: [],
    llmJobs: [],
    nodeUnderstandingMemories: []
  }
}

function createKg4ExpansionRecord(overrides: Partial<Kg4NodeExpansionRecord> = {}): Kg4NodeExpansionRecord {
  return {
    id: 'kg4-1',
    paperId: 'paper-1',
    nodeId: 'node-1',
    retrievedPaperIds: ['paper-2'],
    algorithmIdeaCards: [],
    expansionGraphNodes: [],
    expansionGraphEdges: [],
    dataCompleteness: 'partial',
    missingDataReasons: [],
    generatedByJobIds: ['job-1'],
    createdAt: '2026-05-30T00:00:00.000Z',
    updatedAt: '2026-05-30T00:00:00.000Z',
    ...overrides
  }
}

test('FilePaperMemoryRepository.saveSnapshot preserves existing kg4 fallback records', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kg3-file-repo-'))
  const path = join(dir, 'memory.json')
  const repository = new FilePaperMemoryRepository(path)
  const record = createKg4ExpansionRecord()

  try {
    await repository.saveKg4ExpansionRecord(record)
    await repository.saveSnapshot(createSnapshot())

    const saved = await repository.getKg4ExpansionRecord(record.paperId, record.nodeId)

    assert.deepEqual(saved, record)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('FilePaperMemoryRepository.saveKg4ExpansionRecord rejects invalid records', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kg3-file-repo-'))
  const path = join(dir, 'memory.json')
  const repository = new FilePaperMemoryRepository(path)
  const invalidRecord = { ...createKg4ExpansionRecord(), retrievedPaperIds: 'paper-2' } as unknown as Kg4NodeExpansionRecord

  try {
    await assert.rejects(repository.saveKg4ExpansionRecord(invalidRecord), new Error('invalid_kg4_expansion_record'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('SqlitePaperMemoryRepository.saveKg4ExpansionRecord rejects invalid records', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kg3-sqlite-repo-'))
  const path = join(dir, 'memory.sqlite')
  const repository = new SqlitePaperMemoryRepository(path)
  const invalidRecord = { ...createKg4ExpansionRecord(), retrievedPaperIds: 'paper-2' } as unknown as Kg4NodeExpansionRecord

  try {
    await assert.rejects(repository.saveKg4ExpansionRecord(invalidRecord), new Error('invalid_kg4_expansion_record'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
