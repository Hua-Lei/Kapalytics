# KG 3.0 论文检索工具设计

## 1. 目标

KG 3.0 需要从 mock related paper library 迁移到真实论文来源和本地论文库。

论文检索工具的目标是：

- 为 Node Expansion 2.0 / KG 3.0 提供可信代表论文；
- 支持 arXiv、Semantic Scholar、OpenAlex 和 local provider；
- 统一去重、排序、缓存和来源追踪；
- 确保 LLM 不编造论文；
- 所有检索结果服务学习闭环，而不是普通推荐。

## 2. 官方 API 能力参考

### 2.1 arXiv

arXiv 官方 user manual 确认提供公开导出 API，常用 endpoint：

```text
https://export.arxiv.org/api/query
```

常见参数：

```text
search_query
id_list
start
max_results
sortBy
sortOrder
```

调用方式：

- 支持 HTTP GET 和 POST；
- `search_query` 用于字段检索；
- `id_list` 用于按 arXiv ID 查询；
- `search_query` 与 `id_list` 同时存在时，返回 `id_list` 中同时匹配 query 的论文；
- `start` 使用 0-based paging；
- `max_results` 表示返回数量；
- `sortBy` 支持 `relevance`、`lastUpdatedDate`、`submittedDate`；
- `sortOrder` 支持 `ascending`、`descending`。

返回格式为 Atom 1.0 feed，可解析：

- `<entry><id>`：abstract page URL，可提取 arXiv ID；
- `<title>`：论文标题；
- `<summary>`：摘要；
- `<author><name>`：作者；
- `<published>` / `<updated>`：提交和更新时间；
- `<category>` / `<arxiv:primary_category>`：arXiv 分类；
- `<link rel="alternate">`：abstract URL；
- `<link title="pdf">`：PDF URL；
- `<arxiv:doi>`：可选 DOI；
- `<arxiv:journal_ref>`：可选 journal reference。

官方建议：

- 连续多次调用时加入 3 秒 delay；
- 大结果集应 refine query，生产环境避免一次性请求过多；
- `max_results` 单次 slice 至多 2000；
- 总结果请求上限为 30000；
- 同一 query 的结果每天变化有限，应缓存结果。

### 2.2 Semantic Scholar

Semantic Scholar 提供 Academic Graph API。常用能力：

- paper search；
- paper detail；
- external IDs；
- citations / references；
- fields 参数选择返回字段。

设计中需要保存：

- `paperId`；
- `corpusId`；
- `externalIds`；
- `url`；
- `title`；
- `abstract`；
- `authors`；
- `year`；
- `venue`。

### 2.3 OpenAlex

OpenAlex 提供 Works REST API。官方文档说明 OpenAlex 是开放学术图谱，包含 works、authors、sources、institutions、topics 等实体，并支持 filtering、sorting、grouping 和 search。

常用 endpoint：

```text
https://api.openalex.org/works?search={query}
```

OpenAlex Works 可提供：

- OpenAlex ID；
- DOI；
- display_name；
- authorships；
- publication_year；
- cited_by_count；
- primary_location / best_oa_location；
- open access 信息；
- related works / referenced works；
- topics / concepts。

OpenAlex 目前要求免费 API key，并有免费额度。实现时应支持配置 API key 和 polite pool 信息。

### 2.4 Local Provider

Local provider 用于用户本地论文库：

- 用户上传过的 PDF；
- 已保存的 PaperRecord；
- 本地导入的 BibTeX / DOI / arXiv ID；
- 已分析过的长期图谱。

Local provider 是唯一允许没有外部 API 的真实数据源，但每条记录仍必须有：

- `source: 'local'`；
- `externalId`，可用 `local:{contentHash}`；
- `url` 或 `localPdfPath`；
- `contentHash`。

## 3. 统一接口

```ts
interface PaperSearchProvider {
  id: 'arxiv' | 'semantic_scholar' | 'openalex' | 'local'
  displayName: string
  capabilities: PaperSearchCapability[]
  search(query: PaperSearchQuery): Promise<PaperSearchResult[]>
  getById(id: ProviderPaperId): Promise<PaperSearchResult | null>
  getReferences?(id: ProviderPaperId): Promise<PaperSearchResult[]>
  getCitations?(id: ProviderPaperId): Promise<PaperSearchResult[]>
}

type PaperSearchCapability =
  | 'keyword_search'
  | 'title_search'
  | 'id_lookup'
  | 'references'
  | 'citations'
  | 'open_access_pdf'
  | 'local_fulltext'

interface PaperSearchQuery {
  query: string
  nodeId?: string
  paperId?: string
  searchQueries?: string[]
  yearFrom?: number
  yearTo?: number
  maxResults: number
  requireAbstract?: boolean
  requirePdf?: boolean
  providerHints?: string[]
}

interface ProviderPaperId {
  provider: 'arxiv' | 'semantic_scholar' | 'openalex' | 'local'
  externalId: string
}
```

## 4. 标准检索结果

```ts
interface PaperSearchResult {
  id: string
  provider: 'arxiv' | 'semantic_scholar' | 'openalex' | 'local'
  source: 'arxiv' | 'semantic_scholar' | 'openalex' | 'local_library'
  externalId: string
  url: string
  pdfUrl?: string
  title: string
  authors: string[]
  year?: number
  venue?: string
  abstract?: string
  doi?: string
  arxivId?: string
  semanticScholarPaperId?: string
  openAlexId?: string
  corpusId?: string
  citedByCount?: number
  referenceIds?: string[]
  topicTags: string[]
  raw: unknown
  fetchedAt: string
}
```

强制要求：

- 每篇论文必须保留 `source`；
- 每篇论文必须保留 `url`；
- 每篇论文必须保留 `externalId`；
- 不能由 LLM 生成这些字段。

## 5. Provider 抽象

### 5.1 ArxivProvider

```ts
class ArxivProvider implements PaperSearchProvider {
  id = 'arxiv'
  displayName = 'arXiv'
  capabilities = ['keyword_search', 'title_search', 'id_lookup', 'open_access_pdf']
}
```

解析规则：

- Atom entry id → `externalId`；
- arXiv abs URL → `url`；
- pdf link → `pdfUrl`；
- category tags → `topicTags`；
- summary → `abstract`。

### 5.2 SemanticScholarProvider

```ts
class SemanticScholarProvider implements PaperSearchProvider {
  id = 'semantic_scholar'
  displayName = 'Semantic Scholar'
  capabilities = ['keyword_search', 'title_search', 'id_lookup', 'references', 'citations']
}
```

字段选择建议：

```text
title,abstract,authors,year,venue,url,externalIds,citationCount,referenceCount,fieldsOfStudy
```

### 5.3 OpenAlexProvider

```ts
class OpenAlexProvider implements PaperSearchProvider {
  id = 'openalex'
  displayName = 'OpenAlex'
  capabilities = ['keyword_search', 'title_search', 'id_lookup', 'references', 'open_access_pdf']
}
```

OpenAlex 能用于：

- 宽覆盖检索；
- DOI / OpenAlex ID 去重；
- 引文数量排序；
- topics / concepts 辅助领域定位；
- OA PDF URL 查找。

### 5.4 LocalProvider

```ts
class LocalProvider implements PaperSearchProvider {
  id = 'local'
  displayName = 'Local Library'
  capabilities = ['keyword_search', 'title_search', 'id_lookup', 'local_fulltext']
}
```

Local provider 优先级高于外部 provider，因为它代表用户真实读过或导入过的材料。

## 6. 检索流程

```text
Node Expansion 请求
→ 读取 node.searchQueries / node.label / paper insight
→ 构造 PaperSearchQuery
→ 并行调用 enabled providers
→ 标准化 PaperSearchResult
→ 去重
→ 排序
→ 缓存
→ 返回候选论文
→ LLM 只基于候选论文做总结/对比
```

## 7. 去重策略

优先使用强 ID 去重：

1. DOI；
2. arXiv ID；
3. Semantic Scholar `paperId` / `corpusId`；
4. OpenAlex ID；
5. normalized title + year + first author。

```ts
interface DedupedPaperCandidate {
  canonicalId: string
  mergedFrom: PaperSearchResult[]
  title: string
  authors: string[]
  year?: number
  sources: PaperSearchResult['source'][]
  externalIds: PaperExternalId[]
  bestUrl: string
  bestPdfUrl?: string
  abstract?: string
}
```

合并策略：

- 标题以 DOI/arXiv/OpenAlex/S2 中更完整者为准；
- abstract 优先选择非空且较长的来源；
- `url` 保留 provider URL；
- `externalIds` 全部保留；
- `raw` 分 provider 保存，不覆盖。

## 8. 排序策略

排序不是“推荐最热门论文”，而是“为当前节点学习最有用”。

建议综合分：

```text
score = lexicalMatch * 0.35
      + semanticTagMatch * 0.25
      + relationToCurrentNodeConfidence * 0.20
      + sourceQuality * 0.10
      + recencyOrCitationSignal * 0.10
```

排序特征：

- query 与 title/abstract/topicTags 匹配；
- 当前节点类型和 provider topics 匹配；
- 是否有 abstract；
- 是否有 PDF；
- 是否来自用户本地读过论文；
- 引用数量和年份只作为辅助，不主导。

## 9. 缓存策略

```ts
interface PaperSearchCacheEntry {
  cacheKey: string
  provider: string
  queryHash: string
  resultJson: PaperSearchResult[]
  createdAt: string
  expiresAt: string
  status: 'hit' | 'miss' | 'stale' | 'error'
}
```

缓存粒度：

- provider + normalized query + filters；
- getById 按 provider + externalId；
- references/citations 按 provider + externalId + relation type。

默认 TTL：

- search：7 天；
- paper detail：30 天；
- local provider：无 TTL，跟随本地库更新时间。

## 10. LLM 防幻觉边界

LLM 不参与论文检索结果生成，只能处理已检索结果。

允许：

- 从候选论文摘要中总结 relationToCurrentNode；
- 比较当前论文和候选论文；
- 生成迁移任务；
- 为候选论文分配 methodFamily，但必须基于已有 title/abstract/topics。

禁止：

- 生成候选列表外的论文；
- 编造标题、作者、年份、venue；
- 编造 DOI、arXiv ID、OpenAlex ID、Semantic Scholar ID；
- 用没有 source/url/externalId 的论文进入对比工作台。

验证规则：

```text
LLM 输出中的 relatedPaperId 必须存在于 candidates。
LLM 输出不能新增 paper title。
LLM 输出的 source/url/externalId 必须来自 provider result。
```

## 11. 去除假数据策略

KG 3.0 后：

- mock library 只保留在测试 fixture；
- dev mode 可显式启用 mock；
- production 默认使用 local + enabled API providers；
- 无真实结果时展示空状态；
- UI 不显示“代表论文”占位卡。

空状态：

```text
没有找到可验证来源的相关论文。
请开启 arXiv / Semantic Scholar / OpenAlex 检索，或导入本地论文库。
```

## 12. 与学习闭环的关系

检索结果进入学习系统的唯一方式：

```text
检索到真实论文
→ 生成 relationToCurrentNode
→ 构造方向地图 / 谱系 / 对比表
→ 生成迁移任务
→ 用户作答
→ AI 诊断
```

这保证检索工具不是论文推荐，而是学习任务的数据来源。

## 13. UI 等待状态

检索过程应有细粒度状态：

```text
正在查询 arXiv...
正在查询 Semantic Scholar...
正在查询 OpenAlex...
正在检索本地论文库...
正在合并重复论文...
正在筛选有可信来源的候选论文...
正在等待 LLM 分析候选论文与当前节点的关系...
```

建议 UI：

- provider-level progress chips；
- 每个 provider 单独显示 success / empty / error；
- 候选论文逐步出现；
- LLM 分析关系时使用局部 skeleton 和“正在分析关系”文案。

## 14. 评分标准提升

### AI 参与机制

AI 基于真实检索结果生成关系、比较和迁移任务，而不是凭空推荐。

### 学习闭环

检索结果必须转化为对比阅读和迁移任务，继续接入作答和诊断。

### 错误反馈

诊断可以引用真实代表论文与当前节点的关系，反馈更具体。

### 可扩展性

统一 provider 接口让系统从 mock 平滑升级到 arXiv、Semantic Scholar、OpenAlex 和本地库。
