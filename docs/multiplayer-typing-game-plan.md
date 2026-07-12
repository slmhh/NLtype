# 多人打字游戏 — 项目计划书（v2 — Go 后端版）

> **目标**: 打造一款支持实时对战的多人打字游戏，兼具练习模式、竞技对战、数据追踪等核心体验。  
> **参考产品**: Monkeytype, 10fastfingers, TypeRacer, NitroType, Keybr, Typing.com  
> **版本说明**: v2 将后端从 Node.js/Socket.IO 更换为 Go/Gorilla WebSocket，并整合了技术评审中的系统性改进建议。

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
| 文本库 | 内置英文单词、常见句子、名人名言、代码片段等多类文本源，附带管理入口 |
| 实时结果结算 | 游戏结束后展示排名、个人统计数据、重播回放 |
| 基础用户系统 | 用户名注册、游客快速进入、游戏历史记录 |
| 排行榜 | 基于 Redis Sorted Set 的单模式排行榜（今日/本周/全部） |
| 文本管理工具 | 简单的后台入口或 CLI 脚本供运营人员添加和标记文本 |

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
| 自定义文本防守 | 用户可上传或粘贴自选文本进行练习/对战（需经 DOMPurify 清洗防 XSS） |
| 比赛录像重播 | 逐字回放对战中每位玩家的输入过程（Web Worker 解析按键序列） |
| 每日挑战 | 同一段文本所有玩家挑战，每人一次机会，按 WPM 排名 |
| 多语言支持 | 中文、日文等非英文文本输入支持 |
| 无障碍模式 | 高对比度、大字号、屏幕阅读器支持 |

---

## 三、技术栈总览

```
┌─────────────────────────────────────────────────────────┐
│                    客户端 (Client)                        │
│  React + Vite + TailwindCSS + Framer Motion             │
│  WebSocket (原生) / Socket.IO Client (通知类)           │
│  (可选: PWA / Electron / Tauri)                         │
├─────────────────────────────────────────────────────────┤
│                    服务端 (Server)                        │
│  Go + Gin + Gorilla WebSocket                           │
│  Redis (实时状态 + 排行榜)                               │
│  PostgreSQL + Drizzle ORM (持久化存储)                   │
├─────────────────────────────────────────────────────────┤
│                    部署 & DevOps                         │
│  Docker + Docker Compose                                │
│  Nginx / Caddy (反向代理 + SSL)                         │
│  PgBouncer (数据库连接池)                                │
│  GitHub Actions (CI/CD)                                 │
│  Sentry + Prometheus + Grafana (监控)                   │
└─────────────────────────────────────────────────────────┘
```

---

## 四、各模块详细技术选型

### 4.1 前端

| 技术 | 选型 | 选型理由 |
|------|------|----------|
| 框架 | **React 18+** (Vite 构建) | 生态最成熟、社区活跃、组件化适合复杂 UI |
| 状态管理 | **Zustand**（游戏状态）+ **TanStack Query**（REST 缓存） | Zustand 管理所有游戏实时状态（房间、进度、计时器）；TanStack Query 仅管理 REST 数据（排行榜、用户信息、文本列表）；WebSocket 消息直接 `setState` 更新 Zustand，避免冗余缓存层 |
| 路由 | **React Router v6** | 标准方案 |
| 样式 | **TailwindCSS** + **shadcn/ui** | 快速迭代 UI，原子化 CSS，shadcn 提供高质量组件 |
| 动画 | **Framer Motion** | 打字光标闪烁、进度条过渡、排名动画等声明式动画 |
| 实时通信 | **原生 WebSocket**（游戏进度广播）+ **Socket.IO Client**（聊天/通知） | 游戏内高频进度广播用原生 WebSocket 降低协议封装开销；普通聊天/通知用 Socket.IO 享受自动重连和 Fallback |
| 测试 | **Vitest** + **React Testing Library** | 与 Vite 深度集成，快于 Jest |
| 构建 | **Vite** | HMR 极快、构建速度高 |

### 4.2 后端

| 技术 | 选型 | 选型理由 |
|------|------|----------|
| 运行时 | **Go 1.22+** | 编译为原生二进制，内存占用低，goroutine 天然适合高并发 WebSocket 连接管理；单台服务器可支撑数万并发连接 |
| HTTP 框架 | **Gin** 或 **Fiber** | Gin 生态成熟、性能优秀；Fiber 受 Express 启发，若团队熟悉 Express 路线可降低切换成本 |
| WebSocket | **Gorilla WebSocket** | 标准库级别的 WebSocket 实现，轻量无额外协议封装，适合自定义游戏协议 |
| 数据库 | **PostgreSQL 16** | 关系型、支持 JSON/JSONB、全文检索 (tsvector)、事务可靠 |
| 缓存/实时状态 | **Redis 7** | 房间状态、在线玩家、Session、排行榜（Sorted Set） |
| 持久层 | **Drizzle ORM**（TypeScript）或 **sqlx**（Go） | Drizzle 贴近原生 SQL、性能开销接近零；若 Go 后端直接操作数据库，使用 `sqlx` + `pgx` 驱动 |
| 认证 | **JWT** + **bcrypt** | Access token 15 分钟，Refresh token 存 Redis（带过期），提供 `/refresh` 端点 |
| 连接池 | **PgBouncer** | PostgreSQL 连接池代理，防止高并发下连接耗尽 |
| 日志 | **zap** 或 **slog**（Go 标准库） | 输出 JSON 结构化日志，集成 ELK/Loki |

### 4.3 游戏逻辑层（Game Server）

游戏逻辑是核心——处理和同步多人在一局游戏中的实时状态。

- **状态机**: 每个游戏房间有明确的状态周期: `waiting → countdown → playing → finished`
- **同步方案**: 原生 WebSocket + 自定义轻量协议（仅传输位置和时间戳），避免 Socket.IO 的协议封装开销
- **防作弊策略**:
  - **服务端驱动验证**: 客户端仅上报当前光标位置和时间戳，服务端根据文本和该位置计算出应输入的字符，记录每次上报的时间差计算 WPM
  - 位置必须严格递增（不可跳变），若位置突然增加超过阈值则判定作弊
  - 设置 WPM 上限（500 WPM），超过则取消成绩
  - 服务端保存每个玩家在本局中的输入进度快照，重连时下发恢复
- **重连机制**: 服务端保留每个玩家的输入历史（已提交的字符序列），断线 30s 内重连后完整下发，客户端据此重建 UI 并继续游戏
- **玩家退出处理**: 若剩余玩家 ≥ 2，游戏继续；若只剩 1 人，自动结束并记录该玩家成绩；房主退出时自动转让房主

### 4.4 DevOps & 部署

| 层级 | 选型 |
|------|------|
| 容器化 | Docker + Docker Compose（本地开发 + 初期生产） |
| 编排 | 可选 Kubernetes（生产规模增大后） |
| 反向代理 | **Caddy**（初期，自动 HTTPS）→ 后期可换 Nginx / HAProxy |
| CI/CD | GitHub Actions（lint → test → build → deploy） |
| 数据库连接池 | **PgBouncer**（docker-compose 中配置） |
| 监控 | Sentry（错误追踪）、Prometheus + Grafana（关键指标：房间数、在线用户数、WPM 分布、错误率、延迟 P50/P95/P99） |
| 日志 | Go `slog` 输出 JSON 日志，初期 `slog` 本地调试，后期集成 Loki |
| 负载测试 | `k6` 模拟数百个并发房间 |

---

## 五、核心数据模型

### 5.1 用户（User）

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(32) NOT NULL UNIQUE,
  email         VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);
```

### 5.2 用户设置（UserSettings）

```sql
CREATE TABLE user_settings (
  user_id       UUID PRIMARY KEY REFERENCES users(id),
  default_mode  VARCHAR(16) NOT NULL DEFAULT 'time',
  theme         JSONB NOT NULL DEFAULT '{}',
  font_size     INT NOT NULL DEFAULT 20,
  keyboard_layout VARCHAR(16) NOT NULL DEFAULT 'qwerty',
  sound_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.3 游戏记录（GameResult）

```sql
CREATE TABLE game_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         UUID NOT NULL,                -- 同一局多人对战共享一个 game_id
  user_id         UUID NOT NULL REFERENCES users(id),
  mode            VARCHAR(16) NOT NULL,         -- 'time' | 'words' | 'quote' | 'code'
  time_limit      INT,                          -- 对战时长（秒）
  text_id         UUID REFERENCES texts(id),
  wpm             REAL NOT NULL,
  accuracy        REAL NOT NULL,
  cpm             REAL NOT NULL,
  raw_wpm         REAL NOT NULL,                -- 不考虑退格的原始 WPM
  characters      JSONB NOT NULL DEFAULT '{}',  -- {correct, incorrect, missed, extra}
  input_sequence  JSONB,                        -- 压缩后的按键时间戳序列（可选，用于重播和防作弊审查）
  elo_change      REAL,                         -- 段位分变动（Phase 2）
  is_multiplayer  BOOLEAN NOT NULL DEFAULT false,
  rank            INT,                          -- 本局排名
  total_players   INT,                          -- 本局总人数
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_game_results_user_id ON game_results(user_id);
CREATE INDEX idx_game_results_game_id ON game_results(game_id);
CREATE INDEX idx_game_results_created_at ON game_results(created_at);
```

### 5.4 文本库（Text）

```sql
CREATE TABLE texts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          VARCHAR(16) NOT NULL,  -- 'words' | 'quote' | 'code'
  content         TEXT NOT NULL,
  author          VARCHAR(128),
  difficulty      REAL NOT NULL DEFAULT 0,  -- Flesch-Kincaid 可读性评分 或 平均词长+常用词比例
  language        VARCHAR(8) NOT NULL DEFAULT 'en',
  length          INT NOT NULL DEFAULT 0,
  word_count      INT NOT NULL DEFAULT 0,
  used_count      INT NOT NULL DEFAULT 0,  -- 被使用的次数
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 全文搜索索引
CREATE INDEX idx_texts_fts ON texts USING GIN(to_tsvector('english', content));
```

> `difficulty` 计算方式：使用 **Flesch-Kincaid Grade Level** 评分（英文），中文使用平均笔画数 + 常用字比例，由定时任务定期更新。

### 5.5 游戏房间 / 实时会话

> 存储在 Redis 中，非持久化。使用 Redis Hash 或 JSON 类型存储。

```
Room Hash (Redis):
  room:{id} → {
    id            string    -- 房间 ID
    status        string    -- 'waiting' | 'countdown' | 'playing' | 'finished'
    mode          string    -- 游戏模式
    text_id       string    -- 文本 ID
    max_players   int       -- 最大玩家数
    created_at    int64     -- 创建时间戳
    host_id       string    -- 房主用户 ID
    players       string    -- JSON 数组 [{userId, username, progress, wpm, accuracy, inputHistory}]
  }
```

### 5.6 排行榜

> **实时层**：Redis Sorted Set，key = `leaderboard:{mode}:{period}`，member = `userId`，score = `bestWpm`  
> **归档层**：PostgreSQL 定时快照表，用于历史查询和赛季归档。定时任务每小时将当前 Redis 排行榜快照写入 PG。

---



## 六、项目目录结构设计

### 6.1 设计原则

| 原则 | 说明 |
|------|------|
| 单一职责 | 每个目录/包只负责一个关注点 |
| 可扩展 | 新增模式不需要改动已有结构 |
| 横向分层 | 前端/后端/共享类型严格分离 |
| 纵向聚合 | 同一特性的前后端代码在各自的 apps/ 子目录中独立演进 |

### 6.2 完整目录结构

```
NLtyping/
  apps/
    client/              前端 (React + Vite)
      src/
        components/      UI 组件
          TypingGame.tsx     主游戏组件
          TypingDisplay.tsx  打字显示组件
        hooks/           自定义 Hook
          useTypingEngine.ts 打字引擎
          useTimer.ts        倒计时器
        stores/          Zustand 状态管理(规划)
        services/        API 调用层(规划)
        data/            本地降级数据
    server/              后端 (Go)
      cmd/server/main.go 入口
      internal/
        handler/         HTTP + WebSocket 处理器
        middleware/      CORS/日志/认证
        game/            游戏逻辑(规划)
        db/              数据库(规划)
        ws/              WebSocket 协议(规划)
      data/              词库 JSON
  packages/shared/       共享类型
  docs/                  文档
  start.bat              一键启动
```

### 6.3 可扩展性设计

| 扩展场景 | 需要做什么 | 不需要改什么 |
|----------|-----------|-------------|
| 新增单人模式 | 新增组件 + 注册路由 | 打字引擎/后端 API/数据模型 |
| 新增多人模式 | 新增组件 + handler + game 逻辑 | 现有单人模式不变 |
| 新增文本来源 | data/ 添加 JSON, handler 添加路由 | 前端无需改动 |
| 新增语言 | 词库 JSON + handler + UI 选项 | 引擎/状态/渲染不变 |
| 扩展数据模型 | 共享类型加字段 + migration | 已有 handler 正常 |
| 部署到 CDN | 前端 dist/ 传 CDN, 后端二进制 | 前端代码零改动 |

### 6.4 前后端分离落地

- apps/client 和 apps/server 各自独立构建部署
- 前端通过 services/ 统一封装 API 调用
- 后端 internal/ 子包隔离职责
- 共享类型包纯类型声明, 无运行时依赖
- data/ 仅开发降级, 生产从后端 API 获取

### 6.5 渐进式演进

| 阶段 | 新增内容 |
|------|---------|
| MVP | TypingGame + TypingDisplay + useTypingEngine + handler/text.go |
| Phase 2 | stores + handler/room.go + internal/game/ + internal/ws/ |
| Phase 3 | FriendList + handler/friend.go |

---


## 六、前后端分离设计

### 6.1 架构总览

```
┌───────────────────────────────────────────────────────────┐
│                    前端 (Frontend)                          │
│  独立进程 / 端口 5173（开发）/ CDN（生产）                   │
│  React SPA – Zustand(游戏状态) + TanStack Query(REST数据)  │
│  WebSocket(游戏) + Socket.IO(通知)                         │
│  apps/client                                              │
└─────────────────┬─────────────────────────────────────────┘
                  │  REST (HTTP)    WebSocket (ws/wss)
                  │                 Socket.IO (通知)
┌─────────────────▼─────────────────────────────────────────┐
│                   Nginx / Caddy (反向代理)                  │
│                  · 终止 HTTPS                              │
│                  · 静态文件托管                             │
│                  · WebSocket 代理                           │
│                  · 房间粘性路由 (ip_hash)                    │
└─────────────────┬─────────────────────────────────────────┘
                  │
┌─────────────────▼─────────────────────────────────────────┐
│                  Go 后端 (Game Server)                      │
│  独立进程 / 端口 3001 / 可水平扩展                           │
│  Gin HTTP + Gorilla WebSocket + Redis Pub/Sub              │
│  apps/server                                               │
│  ┌──────────────┐  ┌────────────────────┐                  │
│  │  REST API    │  │  Game Logic        │                  │
│  │  注册/登录    │  │  房间管理           │                  │
│  │  排行榜      │  │  实时状态同步       │                  │
│  │  用户资料    │  │  防作弊校验         │                  │
│  │  文本库      │  │  断线重连           │                  │
│  └──────┬───────┘  └────────┬───────────┘                  │
│         │                   │                              │
│  ┌──────▼───────┐  ┌───────▼───────────┐                  │
│  │  sqlx + pgx  │  │  go-redis         │                  │
│  └──────┬───────┘  └───────┬───────────┘                  │
└─────────┼──────────────────┼──────────────────────────────┘
          │                  │
     ┌────▼─────┐       ┌───▼────┐
     │ PgBouncer│       │  Redis │
     │ 连接池    │       │ 状态+  │
     │          │       │ 排行榜 │
     └────┬─────┘       └────────┘
          │
     ┌────▼─────┐
     │PostgreSQL│
     │ 持久化   │
     └──────────┘
```

### 6.2 通信协议规范

WebSocket 事件明确定义名称和 payload 结构：

| 方向 | 事件名 | payload | 说明 |
|------|--------|---------|------|
| C→S | `room:join` | `{ roomId, userId }` | 加入房间 |
| C→S | `game:progress` | `{ position, timestamp }` | 上报进度（仅位置+时间戳）|
| S→C | `room:update` | `{ players[], status }` | 房间状态更新 |
| S→C | `game:sync` | `{ progress[] }` | 所有玩家进度广播 |
| S→C | `game:result` | `{ results[] }` | 游戏结果 |
| S→C | `game:recover` | `{ inputHistory[], gameState }` | 断线重连恢复数据 |

### 6.3 开发协作方式

```
前端 (5173)          Go 后端 (3001)
    │                     │
    │  http://localhost:3001  │
    │◄─────── REST API ──────►│
    │                     │
    │  ws://localhost:3001 │
    │◄────── WebSocket ────►│
```

- Vite 配置 proxy 转发 `/api` 请求到后端
- Go 后端编译为单文件二进制，`go run` 即可本地开发
- 前端可用 mock 数据独立开发 UI，不受后端开发进度影响

### 6.4 水平扩展策略

| 场景 | 策略 |
|------|------|
| 单一实例 | 所有房间和连接都在同一个 Go 进程中，无需跨实例通信 |
| 多实例部署 | Nginx 配置 `ip_hash` 实现**房间粘性**，同一房间的 WebSocket 连接始终路由到同一后端实例 |
| 跨实例必要通信 | Redis Pub/Sub 转发房间关闭、玩家踢出等低频管理事件（不做实时进度转发） |

---

## 七、关键技术难点与应对策略

| 难点 | 策略 |
|------|------|
| **实时同步延迟** | Go goroutine + 原生 WebSocket，每 50ms 广播一次位置快照；客户端乐观更新 + 服务端 Reconciliation |
| **防作弊** | **服务端驱动验证**：客户端仅上报光标位置+时间戳，位置须严格递增；服务端根据位置计算 WPM，异常跳变判定作弊；设 WPM 上限 500 |
| **文本公平性** | 同一房间所有玩家使用完全相同文本；允许玩家声明键盘布局（QWERTY/Dvorak），排名仅在同一布局内比较 |
| **水平扩展** | Nginx ip_hash 做房间粘性路由，避免跨实例广播；必须跨实例时用 Redis Pub/Sub 只传管理事件 |
| **断线重连** | 服务端保存每个玩家的输入进度快照（已提交字符序列），断线 30s 内重连后完整下发，客户端据此重建 UI |
| **玩家中途退出** | 剩余 ≥ 2 人继续；仅剩 1 人自动结束并记录成绩；房主退出自动转让 |
| **大文本同步性能** | 增量同步（只传 diff），压缩 payload |
| **数据库连接耗尽** | PgBouncer 连接池代理，池大小 20-50 |
| **自定义文本安全** | DOMPurify 清洗 HTML 标签防 XSS；ORM/原生 SQL 防 SQL 注入 |

---

## 八、参考网站功能对比

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

---

## 九、推荐开发路线

```
Phase 1 — MVP (7 周 + 测试)

Week 1-2:  项目脚手架搭建
            · Vite + React + TailwindCSS 初始化
            · Go + Gin + Gorilla WebSocket 后端初始化
            · Docker Compose 开发环境 (PG + Redis + PgBouncer)
            · 基础用户系统（注册/登录/游客）
            · Monorepo 结构搭建（Turborepo / pnpm workspace）
            · 定义前后端 WebSocket 事件规范

Week 3-4:  单人练习模式
            · 文字显示与键盘输入捕获
            · WPM / 准确率实时计算
            · 计时模式（15s/30s/60s/120s）
            · 结果页展示
            · 文本库系统 + 管理入口（CLI 或后台）
            · 单元测试覆盖核心逻辑
            · 提前接入 WebSocket 心跳/连接管理基础

Week 5-7:  多人对战核心（3 周）
            · 房间创建/加入/退出 + 房间状态机
            · 原生 WebSocket 实时进度同步（纯位置广播）
            · 服务端防作弊校验（位置递增 + WPM 上限）
            · 断线重连 + 输入历史恢复
            · 玩家退出/房主转让处理
            · 实时排名 UI 动画 + 进度条
            · 网络抖动/错误处理
            · 集成测试覆盖房间生命周期

Week 8:    MVP 收尾 + 测试
            · 排行榜（Redis Sorted Set 实时 + PG 归档）
            · 游戏结果持久化 + game_id 关联
            · 负载测试（k6 模拟数百并发房间）
            · Nginx / Caddy 部署配置
            · CI/CD 流水线（lint → test → build → deploy）
            · 基础 UI 打磨 + Bug 修复

Week 9+:  Phase 2 & 3 迭代
            · 匹配系统
            · 段位系统（ELO + elo_change 记录）
            · 好友系统
            · 自定义主题 + UserSettings 表
            · 每日挑战
            · 多语言支持
            · 比赛录像重播（Web Worker 解析按键序列）
```

---

## 十、备选技术方案

| 场景 | 备选方案 | 适用场景 |
|------|----------|----------|
| 后端 | **Node.js + Fastify + Socket.IO** | 团队 Node 经验更丰富；更快的原型速度；可共享前端 TypeScript 类型 |
| 后端 | **Rust (Actix-Web)** | 最高吞吐与最低延迟；愿意接受编译开销；实时同步压力极大 |
| 实时通信 | **WebRTC DataChannel** | P2P 场景，减少服务器中转；NAT 穿透复杂，适合小房间 |
| 前端 | **Solid.js** 或 **Svelte** | 追求更小打包体积与更高渲染性能 |
| 反代 | **Caddy**（推荐）→ **HAProxy** / 云负载均衡 | Caddy 自动 HTTPS 简化初期配置；HAProxy 适合大规模生产 |
| 全栈 DB | **Supabase** (PostgreSQL + Realtime) | 快速原型，内置认证 + 实时订阅 + 存储 |
| 监测 | **Sentry**（错误追踪）+ **Grafana**（指标仪表盘）| MVP 阶段优先接入 Sentry 捕获前端/后端错误 |

---

## 十一、开发规范与工具

- **版本管理**: Git + Conventional Commits
- **代码风格**: Go 使用 `gofmt` + `golangci-lint`；前端使用 ESLint + Prettier
- **Go 项目布局**: 参考 [golang-standards/project-layout](https://github.com/golang-standards/project-layout)
- **Git 分支**: main / develop / feature-* / hotfix-*
- **API 设计**: RESTful（非实时）+ WebSocket Event（实时），共享 `packages/shared` 中的事件类型定义
- **测试策略**:
  - 每周开发中穿插足量的单元测试和集成测试
  - MVP 收尾阶段安排至少 2 天的负载测试（k6）
  - 单人模式测试：Vitest / Go `testing` 包
  - 多人模式测试：k6 模拟客户端连接
- **健康检查**: Go 后端提供 `/health` 端点（含数据库和 Redis 连接状态）和就绪探针

---

> **下一步**: 确认技术选型后，开始搭建 Monorepo 项目结构、Go 后端框架和 React 前端脚手架，配置 Docker Compose 开发环境。
