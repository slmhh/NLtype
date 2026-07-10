# 多人打字游戏 — 项目计划书

> **目标**: 打造一款支持实时对战的多人打字游戏，兼具练习模式、竞技对战、数据追踪等核心体验。  
> **参考产品**: Monkeytype, 10fastfingers, TypeRacer, NitroType, Keybr, Typing.com

---

## 一、项目概述

| 维度 | 描述 |
|------|------|
| 项目名称（暂定） | TypeRush |
| 核心玩法 | 玩家在时限内输入给定文本，根据速度（WPM/CPM）和准确率排名，支持多人实时对战 |
| 目标用户 | 打字爱好者、希望提升打字速度的学生/职场人、寻求轻竞技体验的游戏玩家 |
| 主要差异化 | 真正的多人实时对战（非异步）、多模式支持、数据统计沉淀 |

---

## 二、功能规划（MVP → V2）

### Phase 1 — MVP（核心可玩版本）

| 功能模块 | 具体内容 |
|----------|----------|
| 单人练习模式 | 随机单词/短文输入，计时模式（15s/30s/60s/120s），实时 WPM、准确率、字符统计 |
| 多人对抗模式 | 创建/加入房间，2-8 人对战同一文本，实时显示每位玩家的打字进度与排名 |
| 文本库 | 内置英文单词、常见句子、名人名言、代码片段等多类文本源 |
| 实时结果结算 | 游戏结束后展示排名、个人统计数据、重播回放 |
| 基础用户系统 | 用户名注册、游客快速进入、游戏历史记录 |
| 排行榜 | 单模式排行榜（今日/本周/全部） |

### Phase 2 — 社交与成长

| 功能模块 | 具体内容 |
|----------|----------|
| 匹配对战 | 点击"开始匹配"，系统根据分段自动匹配对手 |
| 好友系统 | 添加/删除好友，好友在线状态，好友间发起对战邀请 |
| 段位系统 | 基于 ELO 或 Glicko 算法的排位段位（青铜→钻石） |
| 成就徽章 | 连续登录、里程碑成就、连胜等 |
| 个人主页 | 详细统计数据图表、游戏历史、成就展示 |

### Phase 3 — 深度体验

| 功能模块 | 具体内容 |
|----------|----------|
| 自定义主题 | 配色方案、字体选择、光标样式 |
| 自定义文本 | 用户可上传或粘贴自选文本进行练习/对战 |
| 比赛录像重播 | 逐字回放对战中每位玩家的输入过程 |
| 每日挑战 | 同一段文本所有玩家挑战，每人一次机会，按 WPM 排名 |
| 多语言支持 | 中文、日文等非英文文本输入支持 |
| 无障碍模式 | 高对比度、大字号、屏幕阅读器支持 |

---

## 三、技术栈总览

```
┌─────────────────────────────────────────────────────────┐
│                    客户端 (Client)                        │
│  React + Vite + TailwindCSS + Framer Motion             │
│  Socket.IO Client                                       │
│  (可选: PWA / Electron / Tauri)                         │
├─────────────────────────────────────────────────────────┤
│                    服务端 (Server)                        │
│  Node.js + TypeScript + Fastify                         │
│  Socket.IO + Redis (实时通信 & 状态管理)                  │
│  PostgreSQL (持久化存储)                                 │
├─────────────────────────────────────────────────────────┤
│                    部署 & DevOps                         │
│  Docker + Docker Compose                                │
│  Nginx (反向代理 + SSL)                                 │
│  GitHub Actions (CI/CD)                                 │
└─────────────────────────────────────────────────────────┘
```

---

## 四、各模块详细技术选型

### 4.1 前端

| 技术 | 选型 | 选型理由 |
|------|------|----------|
| 框架 | **React 18+** (Vite 构建) | 生态最成熟、社区活跃、SSR 可扩展、组件化适合复杂 UI |
| 状态管理 | **Zustand** + **TanStack Query** | Zustand 轻量高性能；TanStack Query 处理服务端状态 |
| 路由 | **React Router v6** | 标准方案 |
| 样式 | **TailwindCSS** + **shadcn/ui** | 快速迭代 UI，原子化 CSS，shadcn 提供高质量组件 |
| 动画 | **Framer Motion** | 打字光标闪烁、进度条过渡、排名动画等声明式动画 |
| 实时通信 | **Socket.IO Client** | 支持自动重连、房间管理、Fallback 到长轮询 |
| 测试 | **Vitest** + **React Testing Library** | 与 Vite 深度集成，快于 Jest |
| 构建 | **Vite** | HMR 极快、构建速度高 |

### 4.2 后端

| 技术 | 选型 | 选型理由 |
|------|------|----------|
| 运行时 | **Node.js** (LTS) | 事件驱动适合高并发实时连接，与前端共享语言 |
| 语言 | **TypeScript** | 类型安全，全栈共享类型定义（前后端同构） |
| HTTP 框架 | **Fastify** | 性能优于 Express，自带 Schema 验证 |
| WebSocket | **Socket.IO** | 内置房间管理、广播、心跳检测、自动重连 |
| 数据库 | **PostgreSQL 16** | 关系型、支持 JSON/JSONB、全文检索 (tsvector)、事务可靠 |
| 缓存/实时状态 | **Redis 7** | 房间状态、在线玩家、Session、排行榜（ioredis） |
| ORM | **Drizzle ORM** 或 **Prisma** | Drizzle 更轻量贴近 SQL；Prisma 开发体验好 |
| 认证 | **JWT** + **bcrypt** | 无状态认证，配合 access/refresh token |
| 测试 | **Vitest** + **Supertest** | 单元与集成测试 |

### 4.3 游戏逻辑层（Game Server）

游戏逻辑是核心——处理和同步多人在一局游戏中的实时状态。

- **状态机**: 每个游戏房间有明确的状态周期: `waiting → countdown → playing → finished`
- **Tick 同步**: 客户端每 50-100ms 发送输入进度到服务端；服务端校验后广播给房间内其他玩家
- **防作弊**: 服务端强制校验文本输入顺序与合法性，WPM 上限封顶
- **重连机制**: 断线玩家在 30s 内可重新加入房间，恢复当前游戏状态

### 4.4 DevOps & 部署

| 层级 | 选型 |
|------|------|
| 容器化 | Docker + Docker Compose（本地开发） |
| 编排 | 可选 Kubernetes（生产规模增大后） |
| 反向代理 | Nginx（SSL 终止 + 静态文件缓存 + WebSocket 代理） |
| CI/CD | GitHub Actions（lint → test → build → deploy） |
| 云平台 | 可选: Railway / Fly.io / Vercel + Supabase（低成本起步） |
| 监控 | Sentry（错误追踪）、Prometheus + Grafana（指标监控） |
| 日志 | Pino（Fastify 原生支持）|

---

## 五、核心数据模型

### 5.1 用户（User）

```
User {
  id            UUID        PK
  username      string      unique
  email         string?     unique
  password_hash string
  avatar_url    string?
  created_at    timestamp
  updated_at    timestamp
  last_login    timestamp
}
```

### 5.2 游戏记录（GameResult）

```
GameResult {
  id            UUID        PK
  user_id       UUID        FK → User
  mode          enum        'words' | 'quote' | 'code' | 'time'
  time_limit    int?        对战时长（秒）
  text_id       UUID        FK → Text
  wpm           float
  accuracy      float
  cpm           float
  raw_wpm       float       （不考虑退格的原始 WPM）
  characters    jsonb       {correct, incorrect, missed, extra}
  is_multiplayer boolean
  rank          int?        本局排名
  total_players int?        本局总人数
  created_at    timestamp
}
```

### 5.3 文本库（Text）

```
Text {
  id              UUID        PK
  source          enum        'words' | 'quote' | 'code'
  content         text
  author          string?
  difficulty      float       （文本难度评分）
  language        string      'en' | 'zh' | ...
  length          int         字符数
  word_count      int
  used_count      int         （被使用的次数）
  created_at      timestamp
}
```

### 5.4 游戏房间 / 实时会话

> 存储在 Redis 中，非持久化。

```
Room {
  id              string      Redis Key
  status          enum        'waiting' | 'countdown' | 'playing' | 'finished'
  mode            string
  text_id         UUID
  max_players     int
  players         Player[]    [{userId, socketId, username, progress, wpm, accuracy}]
  host_id         string
  created_at      timestamp
}
```

### 5.5 排行榜（Leaderboard）

```
Leaderboard {
  id            UUID        PK
  user_id       UUID        FK → User
  mode          string
  time_period   enum        'daily' | 'weekly' | 'all_time'
  best_wpm      float
  avg_accuracy  float
  games_played  int
  rank          int         （由定时任务计算）
  updated_at    timestamp
}
```

---

## 六、前后端分离设计

这套架构的核心前提是 **前端和后端完全独立**——它们跑在不同的进程、不同的端口、可以独立开发独立部署，只通过 API 和 WebSocket 互相通信。

### 6.1 分离边界

```
┌───────────────────────────────────────────────────────────┐
│                    前端 (Frontend)                          │
│                                                           │
│  独立进程   端口 5173（开发）/ 443（生产）                    │
│  由 Vite Dev Server 或 Nginx 托管静态文件                   │
│  职责: UI 渲染、用户交互、键盘输入捕获、本地状态管理          │
│  代码目录: apps/client                                     │
│                                                           │
│  ┌─────────────────────────────────────┐                  │
│  │   React App (SPA)                   │                  │
│  │   ┌─────────┐  ┌───────────────┐   │                  │
│  │   │ Zustand │  │ TanStack Query│   │                  │
│  │   │本地状态  │  │ 服务端状态缓存 │   │                  │
│  │   └─────────┘  └───────┬───────┘   │                  │
│  │                        │           │                  │
│  │              ┌─────────▼────────┐  │                  │
│  │              │  Socket.IO Client│  │                  │
│  │              │  (实时通信)       │  │                  │
│  │              └─────────┬────────┘  │                  │
│  └────────────────────────┼──────────┘                  │
└───────────────────────────┼──────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │  HTTP REST  │  WebSocket  │
              │  (非实时)    │  (实时)     │
              └─────────────┼─────────────┘
                            │
┌───────────────────────────┼──────────────────────────────┐
│                    后端 (Backend)                          │
│                                                           │
│  独立进程   端口 3001（开发）/ 443（生产）                     │
│  由 Node.js 直接运行                                       │
│  职责: 业务逻辑、数据持久化、实时广播、认证鉴权               │
│  代码目录: apps/server                                     │
│                                                           │
│  ┌─────────────────────────────────────┐                  │
│  │  Fastify HTTP Server                │                  │
│  │  ┌──────────┐  ┌──────────────────┐ │                  │
│  │  │ REST API │  │ Socket.IO Server │ │                  │
│  │  │ 注册/登录 │  │ 房间管理         │ │                  │
│  │  │ 排行榜    │  │ 实时广播        │ │                  │
│  │  │ 用户资料  │  │ 游戏状态同步    │ │                  │
│  │  │ 文本库   │  │ 断线重连        │ │                  │
│  │  └──────────┘  └──────────────────┘ │                  │
│  │  ┌──────────┐  ┌──────────────────┐ │                  │
│  │  │ Drizzle  │  │ ioredis          │ │                  │
│  │  │ (PG ORM) │  │ (Redis 客户端)   │ │                  │
│  │  └────┬─────┘  └───────┬──────────┘ │                  │
│  └───────┼───────────────┼────────────┘                  │
└──────────┼───────────────┼───────────────────────────────┘
           │               │
     ┌─────▼─────┐    ┌────▼────┐
     │ PostgreSQL│    │  Redis  │
     │ 持久化数据 │    │ 实时状态 │
     │ 用户/成绩  │    │ 房间/在线 │
     │ 文本库    │    │ 排行榜   │
     └───────────┘    └─────────┘
```

### 6.2 通信方式

| 通信方式 | 协议 | 用途 | 请求方 → 响应方 |
|----------|------|------|----------------|
| REST API | HTTP/HTTPS | 注册登录、获取排行榜、查询用户资料、获取文本列表 | 前端 → 后端 |
| WebSocket | ws/wss | 加入/创建房间、实时进度同步、游戏广播、心跳检测 | 双向（前端 ↔ 后端）|

### 6.3 开发时的协作方式

本地开发时前后端各跑各的:

```
前端 (port 5173)         后端 (port 3001)
    │                         │
    │  http://localhost:3001  │
    │◄─────── REST API ──────►│
    │                         │
    │  ws://localhost:3001    │
    │◄────── WebSocket ──────►│
    │                         │
```

- 前端的 Vite Dev Server 配置了 proxy，开发时 `/api` 开头的请求自动转发到后端 3001 端口，避免跨域问题。
- 后端的 Fastify 也配置了 CORS，允许前端 5173 的跨域请求。
- 两端各自代码修改不需要重启对方。

### 6.4 生产环境的部署方式

```
                       用户浏览器
                           │
                    HTTPS (443)
                           │
                   ┌───────▼───────┐
                   │    Nginx      │
                   │  (反向代理)    │
                   └───┬───────┬───┘
                       │       │
              /api/*   │       │  /* (静态文件)
              /socket  │       │
                       │       │
              ┌────────▼─┐  ┌─▼──────────┐
              │  Backend  │  │  前端静态文件 │
              │  :3001    │  │  (build产物) │
              └──────────┘  └─────────────┘
```

- 前端构建产物（`npm run build` 生成的 HTML/CSS/JS）直接丢给 Nginx 托管
- 所有 `/api/*` 和 `/socket.io/*` 的请求 Nginx 代理转发给后端
- 前端不需要 Node.js 运行时——它就是一堆静态文件，CDN 都能托管
- 后端需要 Node.js 运行时 + PostgreSQL + Redis

### 6.5 这种分离的好处

| 维度 | 前后端分离 | 模板渲染（传统方案） |
|------|-----------|-------------------|
| 部署 | 前端可部署到 CDN，后端可独立扩缩容 | 前端必须跟着后端部署 |
| 开发 | 前端可以用 mock 数据独立开发 UI | 前端必须等后端接口写好才能跑 |
| 扩展 | 后端可以加多个实例水平扩展 | 前端流量也要经过后端服务器 |
| 技术栈 | 前端 React、后端 Fastify，各自独立演进 | 前后端语言绑定 |

## 七、系统架构图（概览）

```
  ┌───────────┐   ┌───────────┐   ┌───────────┐
  │  Client A  │   │  Client B  │   │  Client C  │   (React + Socket.IO Client)
  └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
        │               │               │
        └───────────────┼───────────────┘
                        │ WebSocket (Socket.IO)
                        │
              ┌─────────▼──────────┐
              │   Nginx (反向代理)   │
              └─────────┬──────────┘
                        │
              ┌─────────▼──────────┐
              │  Fastify + Socket   │
              │  Game Server (Node) │
              ├─────────┬──────────┤
              │  Redis   │  PG      │
              │ (实时状态)│(持久化)  │
              └─────────┴──────────┘
```

### 7.1 游戏生命周期

```
玩家创建/加入房间
       │
       ▼
   等待中 (waiting)
   · 房主设置模式、文本、人数
   · 大厅显示所有玩家准备状态
       │
       ▼
   倒计时 (countdown) — 3..2..1
       │
       ▼
   游戏中 (playing)
   · 服务端下发文本
   · 客户端逐字输入，实时推送进度
   · 每 50-100ms 客户端上报 {position, timestamp, keystrokes}
   · 服务端校验 → 更新房间状态 → 广播给所有玩家
   · 玩家实时看到其他人的进度条/光标位置
       │
       ▼
   结束 (finished)
   · 最后一名完成 / 时间耗尽
   · 展示排名、详细统计数据
   · 结果写入 PostgreSQL
   · 房间解散或进入下一局
```

---

## 八、关键技术难点与应对策略

| 难点 | 策略 |
|------|------|
| **实时同步延迟** | 客户端乐观更新 + 服务端定时广播（50ms tick），预测+ Reconciliation |
| **防作弊** | 服务端做最终 WPM 计算，客户端只上传原始按键序列，拒绝异常进度 |
| **文本公平性** | 同一房间所有玩家使用完全相同文本 |
| **并发房间数** | Redis Pub/Sub 支持水平扩展多 Game Server 实例 |
| **断线重连** | Socket.IO 原生支持重连；服务端保留房间状态 30s |
| **大文本同步性能** | 增量同步（只传 diff），压缩 payload |

---

## 九、参考网站功能对比

| 功能 | Monkeytype | 10fastfingers | TypeRacer | NitroType | Keybr |
|------|-----------|--------------|-----------|-----------|-------|
| 单人练习 | ✅ | ✅ | ❌ | ❌ | ✅ |
| 多人实时 | ❌ | ✅ (竞速) | ✅ | ✅ | ❌ |
| 多文本源 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 自定义主题 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 详细数据统计 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 段位/排位 | ❌ | ❌ | ✅ | ✅ | ❌ |
| 代码片段 | ✅ (社区) | ❌ | ❌ | ❌ | ❌ |
| 匹配系统 | ❌ | ✅ | ✅ | ✅ | ❌ |
| 英文为主 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 开源 | ✅ | ❌ | ❌ | ❌ | ❌ |

### 9.1 关键参考点

- **Monkeytype** — UI/UX 设计参考（极简美学、丰富自定义、流畅光标动画、结果页数据卡片）
- **TypeRacer** — 多人赛车玩法参考（进度可视化、实时排名变化）
- **10fastfingers** — 多人竞速模式参考（房间制 + 匹配制共存）
- **NitroType** — 游戏化参考（段位、经济系统、车辆升级等）
- **Keybr** — 自适应文本生成算法参考（按用户弱点生成针对性文本）

---

## 十、推荐开发路线

```
Week 1-2:  项目脚手架搭建
            · Vite + React + TailwindCSS 初始化
            · Fastify + Socket.IO 后端初始化
            · Docker Compose 开发环境 (PG + Redis)
            · 基础用户系统（注册/登录/游客）

Week 3-4:  单人练习模式
            · 文字显示与键盘输入捕获
            · WPM / 准确率实时计算
            · 计时模式（15s/30s/60s/120s）
            · 结果页展示
            · 文本库系统

Week 5-6:  多人对战核心
            · 房间创建/加入/退出
            · Socket.IO 房间管理
            · 实时进度同步与广播
            · 防作弊校验
            · 断线重连

Week 7:    MVP 收尾
            · 排行榜（Redis Sorted Set）
            · 游戏结果持久化
            · Nginx 部署配置
            · 基础 UI 打磨

Week 8+:  Phase 2 & 3 迭代
            · 匹配系统
            · 段位系统
            · 好友系统
            · 自定义主题
            · 每日挑战
            · 多语言支持
```

---

## 十一、备选技术方案

| 场景 | 备选方案 | 适用场景 |
|------|----------|----------|
| 后端 | **Go (Gin + Gorilla WebSocket)** | 对延迟极致敏感；服务器成本敏感 |
| 后端 | **Rust (Actix-Web)** | 最高吞吐与最低延迟；愿意接受编译开销 |
| 实时通信 | **WebRTC DataChannel** | P2P 场景，减少服务器中转 |
| 前端 | **Solid.js** 或 **Svelte** | 追求更小打包体积与更高渲染性能 |
| 全栈 DB | **Supabase** (PostgreSQL + Realtime) | 快速原型，内置认证 + 实时订阅 + 存储 |

---

## 十二、开发规范与工具

- **版本管理**: Git + Conventional Commits
- **代码风格**: ESLint + Prettier（含 import 排序）
- **Git 分支**: main / develop / feature-* / hotfix-*
- **API 设计**: RESTful（非实时）+ WebSocket Event（实时），统一事件命名规范
- **前后端协议**: 共享 TypeScript type 包（monorepo 风格，Turborepo 或 Nx）

---

> **下一步**: 确认技术选型和 Phase 1 范围后，可以开始项目脚手架搭建 — 初始化 monorepo、配置 Docker Compose 开发环境、搭建基础前后端通信示例。
