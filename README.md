# Kapalytics

从 AI 领域论文到知识洞察。一款基于 Electron 的桌面论文阅读工具，通过 LLM 辅助分析论文、构建知识图谱，帮助你深入理解研究方法及其演进脉络。

## 功能

- PDF 论文提取与结构化分析
- 多阶段论文阅读框架（领域定位 → 问题动机 → 方法概述 → 公式算法 → 实验分析 → 贡献局限）
- LLM 驱动的论文分析，支持多模型提供商（DeepSeek 等）
- 研究方法谱系图，追踪方法的演进关系
- Semantic Scholar 论文检索与元数据补全
- 本地知识图谱持久化存储

## 环境要求

- Node.js >= 18
- pnpm 或 npm

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/Hua-Lei/Kapalytics.git
cd Kapalytics

# 安装依赖
npm install

# 启动开发模式
npm run dev
```

首次启动后需要在设置中配置 LLM API Key。

## 打包为 Release

```bash
# 编译生产构建
npm run build

# 安装打包工具
npm install --save-dev electron-builder

# 打包为可分发的安装包（输出到 release/ 目录）
npx electron-builder --win --config='{
  "appId": "com.kapalytics.app",
  "productName": "Kapalytics",
  "directories": { "output": "release" },
  "files": ["out/**/*", "package.json"],
  "win": { "target": "nsis" }
}'
```

Windows 下会生成 `release/Kapalytics Setup x.x.x.exe` 安装包。

## 项目结构

```
src/
  main/          # Electron 主进程
    index.ts     # IPC 处理 & 应用入口
    kg4/         # 知识图谱扩展（谱系、方法摘要）
    llm/         # LLM 调用、编排、提示词
    paper/       # PDF 提取
    retrieval/   # 论文检索 & 元数据补齐
    memory/      # 本地知识库存储
  renderer/      # React 前端
    src/
      components/  # UI 组件
      domains/     # 业务逻辑（扩展、记忆、阶段框架）
      App.tsx      # 应用根组件
```

## License

MIT
