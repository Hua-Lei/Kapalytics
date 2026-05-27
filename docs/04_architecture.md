# 项目架构

## 技术栈

本项目使用：

- Electron
- React
- Vite
- TypeScript

其他依赖库不在本文档中强制指定。  
如果需要新增依赖，开发者或 AI agent 必须说明：

1. 为什么需要该依赖；
2. 它解决什么问题；
3. 是否有更简单的替代方案。

## 目录结构建议

```text
src/
  main/                 Electron 主进程相关代码
  renderer/             React 前端代码
    components/         UI 组件
    pages/              页面级组件
    modules/            核心业务逻辑
    types/              TypeScript 类型定义
    mock/               mock 数据
    styles/             样式
```

## 推荐模块划分

```text
modules/
  paper/                论文解析与结构化
  graph/                知识图谱构建
  learning/             分层学习流程
  task/                 阶段任务生成
  diagnosis/            错误诊断与反馈
  state/                学习状态管理
  llm/                  AI 调用封装
  storage/              本地存储
```

## 模块边界

### components/

只负责界面展示，不写复杂业务逻辑。

### modules/paper/

负责论文文本、章节、摘要、方法和实验部分的处理。

### modules/graph/

负责将论文结构转为知识图谱数据。

### modules/learning/

负责学习阶段流转、阶段状态和下一步推荐。

### modules/task/

负责根据当前阶段生成任务。

### modules/diagnosis/

负责判断用户错误类型和生成反馈。

### modules/state/

负责维护掌握度、学习进度和错误历史。

### modules/llm/

所有 AI 调用必须统一经过该模块。

### modules/storage/

负责本地保存和读取学习记录。

## 禁止事项

1. 不要在 UI 组件里直接调用 AI API。
2. 不要把 prompt 分散写在多个组件里。
3. 不要在 PDF 显示组件里写学习流程逻辑。
4. 不要在知识图谱组件里写错误诊断逻辑。
5. 不要一次性实现所有扩展功能。
6. 不要为了小功能引入大型依赖。
