# Kapalytics v1.0 演示脚本

## 准备

```bash
npm run dev
```

应用启动，显示三栏式学习工作台。

---

## 第一步：上传论文 PDF（R2/R7）

1. 点击左侧面板「选择 PDF 文件」按钮
2. 在文件对话框中选择 `pdf/T2L.pdf`（或其他示例 PDF）
3. 左侧面板显示 PDF 内容
4. 点击标题栏「更换」可切换其他 PDF

**验收**：PDF 填充左侧面板，无延伸/空白，缩放按钮不影响 PDF 尺寸。

---

## 第二步：输入论文信息（R5/R8）

1. 点击中间面板「知识图谱」tab
2. 右侧面板显示「论文信息」输入框
3. 粘贴以下摘要（或自行输入）：

> The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train. Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles, by over 2 BLEU.

4. 点击「AI 生成知识图谱」（需配置 API Key）或直接使用默认图谱
5. 点击「AI 生成任务」或使用默认任务

**验收**：中间面板显示知识图谱节点（field/concept/problem/method 等 7 种类型），学习路径 tab 显示 7 个阶段任务。

---

## 第三步：查看知识图谱（R3）

1. 在「知识图谱」tab 中：
   - 滚轮缩放图谱（0.3x ~ 3x）
   - 拖拽空白区平移
   - 拖拽节点调整布局
2. 点击不同节点，右侧显示节点详情（类型、描述）
3. 点击「学习路径」tab 切换回阶段列表

**验收**：7 种节点类型视觉可区分，点击后右侧显示详情，图谱可缩放/平移/拖拽节点。

---

## 第四步：完成学习阶段（R4/R5）

1. 切到「学习路径」tab
2. 点击阶段 1「领域定位」→ 右侧显示阶段描述 + 「开始学习」按钮
3. 点击「开始学习」→ 状态变为「学习中」，显示任务题目
4. 在输入框中输入答案，例如：

> Transformer 属于 NLP/自然语言处理领域，用自注意力替代 RNN 进行序列到序列建模。与 CV 不同在于处理的是离散序列而非连续像素，与 RL 不同在于不需要 reward 信号。

5. 点击「提交答案」

**验收**：阶段状态流转正常（未开始 → 学习中 → 提交答案）。

---

## 第五步：查看诊断反馈（R6）

1. 提交后右侧显示诊断结果：
   - **正确**：绿色横幅 + 「继续」按钮，掌握度 +20
   - **错误**：红色横幅 + 错误类型 + 详细反馈 + 补救任务
2. 点击「重新作答」返回编辑
3. 点击「标记已理解」/「继续」→ 状态变为「已完成」

**验收**：诊断结果包含错误类型（7 种之一）、针对性反馈、补救任务。掌握度更新。

---

## 第六步：触发错误反馈（R6 演示）

1. 选择某个未完成阶段，点击「开始学习」
2. 故意输入不相关的答案，例如只输入「不知道」或「123」
3. 点击「提交答案」
4. 系统返回错误诊断：未匹配关键词，显示对应错误类型 + 反馈 + 补救任务
5. 阶段自动标记为「需复习」

**验收**：简短/错误答案稳定触发对应阶段的错误类型，非随机。

---

## 第七步：查看学习状态（R7）

1. 完成部分阶段后，点击其他区域取消选中
2. 右侧面板空状态显示「推荐下一步：阶段 X — XXX」
3. 阶段列表中已完成阶段显示绿色 ✓ + 「已完成」徽章
4. 需复习阶段显示橙色「需复习」徽章
5. 选中阶段时显示掌握度进度条

**验收**：状态追踪完整，推荐逻辑正确，掌握度可视化。

---

## 第八步：知识图谱交互（R3）

1. 拖拽节点重新排列布局
2. 点击 `↺` 重置视图
3. 折叠/展开左侧 PDF 面板，图谱自适应
4. 拖拽面板分隔条调整宽度

**验收**：图谱跟随容器自适应，面板操作不影响功能。

---

## 第九步：API 配置（v0.8）

1. 顶部栏点击「设置」
2. 弹窗中输入 DeepSeek API Key
3. 点击「保存」→ 状态更新为已配置
4. 点击「测试连接」→ 显示连接成功/失败
5. 配置后重新生成知识图谱/任务 → 使用 AI 实时生成

**验收**：API Key 存储安全（Main Process），配置流程完整。

---

## 第十步：本地恢复（R8/v0.9）

1. 完成部分学习阶段后关闭应用
2. 重新执行 `npm run dev`
3. 应用自动恢复：上次 PDF、阶段状态、答案、掌握度

**验收**：重开后数据完整恢复，不丢失。

---

## 验收清单

- [x] PDF 上传 + 显示（R2/R7）
- [x] 知识图谱 7 种节点类型可区分（R3）
- [x] 图谱可缩放/平移/拖拽节点
- [x] 7 阶段学习流转（R4）
- [x] 阶段任务生成（R5）
- [x] 7 种错误类型诊断（R6）
- [x] 掌握度跟踪 + 下一步推荐（R7）
- [x] 本地保存/恢复（R8）
- [x] API Key 配置 + 连接测试（v0.8）
- [x] AI 生成图谱/任务（v1.0）
- [x] 面板折叠/展开/拖拽调整
- [x] 字号缩放不影响 PDF
- [x] `npm run typecheck` 通过
- [x] `npm run build` 通过
