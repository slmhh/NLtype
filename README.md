# NLType

NLType 是一个支持中英文的多人实时打字练习与对战平台，覆盖单人练习、多人竞速、数据追踪与社交成长功能。

---

## 你可以在这里做什么

- **单人打字练习** — 计时模式（15s / 30s / 60s / 120s），支持英文单词与中文语段
- **文字数据追踪** — 实时 WPM、准确率、CPM、原始 WPM、字符统计
- **中英文切换** — English / 中文 无缝切换，中文支持输入法（IME）输入
- **实时对战（开发中）** — 多人房间竞速、警察抓小偷追逐模式
- **历史记录与成就（开发中）** — 个人主页、成绩曲线、成就徽章

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite + TypeScript + TailwindCSS |
| 状态管理 | Zustand（游戏状态）+ TanStack Query（服务端缓存）|
| 后端 | Go 1.22 + Gin / Gorilla WebSocket |
| 数据库 | PostgreSQL 16 + Redis 7 |
| 连接池 | PgBouncer |
| 实时通信 | WebSocket（原生，游戏进度）+ Socket.IO（通知类）|
| 部署 | Docker + Docker Compose + Nginx / Caddy |

---

## 目录概览

```
NLtyping/
├── apps/
│   ├── client/              # React 前端
│   │   ├── src/
│   │   │   ├── components/  # 游戏组件（TypingGame, TypingDisplay）
│   │   │   ├── hooks/       # 核心逻辑（useTypingEngine, useTimer）
│   │   │   └── data/        # 词库数据（本地 fallback）
│   │   └── ...
│   └── server/              # Go 后端
│       ├── cmd/server/      # 入口
│       ├── data/            # 词库 JSON（英文 470 词，中文 50 条）
│       └── go.mod
├── packages/
│   └── shared/              # 共享类型定义
├── docs/                    # 项目计划书、游戏设计文档
├── .tools/                  # Go 工具链（本地开发，不提交）
├── start.bat                # 一键启动脚本
└── .gitignore
```

---

## 快速开始

### 前置依赖

- Node.js 20+（前端）
- Go 1.22+（后端）
- pnpm（包管理）
- PostgreSQL 16 + Redis 7（多人模式需要，单人练习可跳过）

### 启动开发环境

```powershell
# 一键启动（Go 后端 + Vite 前端）
.\start.bat
```

或分别启动：

```powershell
# 终端 1：Go 后端
cd apps\server
set GOROOT=D:\Code\NLtyping\.tools\go
set GOCACHE=D:\Code\NLtyping\.tools\go-cache
set PORT=3001
go build -o server.exe ./cmd/server/
.\server.exe

# 终端 2：前端
cd apps\client
npx vite --host
```

### 访问地址

| 服务 | 地址 |
|------|------|
| 游戏界面 | http://localhost:5173/ |
| 后端 API | http://localhost:3001/ |
| 健康检查 | http://localhost:3001/api/health |
| 英文文本 | http://localhost:3001/api/text/english |
| 中文文本 | http://localhost:3001/api/text/chinese |

---

## 文档入口

- [项目计划书](/docs/multiplayer-typing-game-plan.md) — 技术选型、架构设计、开发路线
- [游戏设计文档](/docs/game-design.md) — 单人模式、多人模式、房间系统、UI/UX

---

## 开发路线

```
Phase 1 — MVP (已完成)
  ✅ 项目脚手架搭建（Monorepo + Go 后端 + React 前端）
  ✅ 单人计时模式（中英文）
  ✅ 双行交替显示（预期行 + 输入行）
  ✅ 文本 API 服务（Go + JSON 词库）
  ✅ 隐藏 textarea IME 输入支持

Phase 2 — 多人对战（进行中）
  🚧 房间创建 / 加入 / 退出
  🚧 WebSocket 实时进度同步
  🚧 防作弊校验 + 断线重连

Phase 3 — 社交与成长
  🔲 匹配系统
  🔲 段位系统（ELO）
  🔲 好友系统
  🔲 自定义主题
  🔲 每日挑战
```

---

## 规范说明

- 代码中所有中文 UI 文本使用 Unicode 跳脱序列（`\uXXXX`）避免编码问题
- 词库数据优先从 Go 后端 API 获取，不可用时自动降级到本地 fallback
- 前端构建产物（`dist/`）不提交，Go 编译产物（`*.exe`）不提交
- `.tools/` 目录为本地 Go 工具链，每台机器单独下载
- 所有文档示例使用占位符，不写真实凭据

---

> 项目状态：Alpha — 单人模式可用，多人模式开发中
