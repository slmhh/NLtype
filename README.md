# NLType

NLType 是一个支持中英文和代码片段的打字练习平台，覆盖单人练习、成绩追踪、用户认证等功能。

---

## 功能特性

- **单人打字练习** — 计时模式（15s / 30s / 60s / 120s）、禅模式、单词模式、引用模式
- **多语言支持** — English / 中文 / Code（代码片段）
- **实时统计** — WPM、准确率、进度条、计时器
- **本地成绩榜** — localStorage 持久化，可查看/清除历史记录
- **暗色/亮色主题** — 跟随系统 CSS 变量，Arco Design 主题同步切换
- **用户认证** — 注册/登录（JWT + bcrypt），会话持久化

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite + TypeScript + TailwindCSS |
| UI 组件 | @arco-design/web-react |
| 路由 | react-router-dom v7 |
| 状态管理 | React Context（ThemeContext / LanguageContext / AuthContext）|
| 打字引擎 | 自定义 hooks（useTypingEngine / useTimer）|
| 数据持久化 | localStorage（成绩 / 主题 / 语言偏好 / Token）|
| 后端 | Fastify 4（Node.js）|
| 认证 | bcryptjs（12 轮盐值）+ JWT（24h 过期）|
| 用户存储 | JSON 文件（`apps/server/data/users.json`）|
| 实时通信 | Socket.IO（预留，尚未接入）|

---

## 目录结构

```
NLtyping/
├── apps/
│   ├── client/                  # React 前端
│   │   └── src/
│   │       ├── components/      # UI 组件
│   │       │   ├── NavBar.tsx
│   │       │   ├── AuthModal.tsx
│   │       │   ├── TypingGame.tsx
│   │       │   └── TypingDisplay.tsx
│   │       ├── context/         # React Context 提供者
│   │       │   ├── AuthContext.tsx
│   │       │   ├── LanguageContext.tsx
│   │       │   └── ThemeContext.tsx
│   │       ├── hooks/           # 核心逻辑
│   │       │   ├── useTypingEngine.ts
│   │       │   └── useTimer.ts
│   │       ├── pages/           # 路由页面
│   │       │   ├── HomePage.tsx
│   │       │   ├── GamePage.tsx
│   │       │   └── LeaderboardPage.tsx
│   │       ├── services/        # API / 存储层
│   │       │   ├── api.ts
│   │       │   ├── results.ts
│   │       │   └── storage.ts
│   │       ├── types/           # TypeScript 类型定义
│   │       ├── data/            # 词库 / 名言 / 代码片段
│   │       └── index.css        # 全局样式 + CSS 变量主题
│   │
│   └── server/                  # Fastify 后端
│       └── src/
│           ├── auth/            # 认证模块
│           │   ├── db.ts        # bcrypt + JWT + JSON 存储
│           │   └── routes.ts    # 注册 / 登录 / 获取用户
│           └── index.ts         # Fastify 入口
├── docs/                        # 设计文档
├── packages/shared/             # 共享类型（预留）
└── start.bat                    # 一键启动脚本（旧版）
```

---

## 快速开始

### 前置依赖

- Node.js 20+
- pnpm（推荐）或 npm

### 启动开发环境

```bash
# 终端 1：后端（端口 3001）
cd apps/server
npm install
npm run dev

# 终端 2：前端（端口 5173）
cd apps/client
npm install
npm run dev
```

### 访问地址

| 服务 | 地址 |
|------|------|
| 游戏界面 | http://localhost:5173/ |
| 后端 API | http://localhost:3001/ |
| 健康检查 | http://localhost:3001/api/health |
| 注册 | `POST /api/auth/register` |
| 登录 | `POST /api/auth/login` |
| 获取当前用户 | `GET /api/auth/me`（需 Bearer Token）|

---

## API 文档

### `POST /api/auth/register`

创建新用户。

**请求体：**
```json
{ "username": "player1", "email": "player1@example.com", "password": "securepass123" }
```

**响应（201）：**
```json
{ "user": { "id": 1, "username": "player1", "email": "player1@example.com", "createdAt": "..." }, "token": "eyJ..." }
```

**错误：** `400`（参数无效）、`409`（用户名或邮箱已存在）

### `POST /api/auth/login`

用户登录。

**请求体：**
```json
{ "identifier": "player1", "password": "securepass123" }
```

`identifier` 可以是用户名或邮箱。

**响应（200）：**
```json
{ "user": { "id": 1, "username": "player1", "email": "player1@example.com", "createdAt": "..." }, "token": "eyJ..." }
```

**错误：** `400`（参数无效）、`401`（凭证错误）

### `GET /api/auth/me`

获取当前登录用户信息。

**请求头：** `Authorization: Bearer <token>`

**响应（200）：**
```json
{ "user": { "id": 1, "username": "player1", "email": "player1@example.com", "createdAt": "..." } }
```

**错误：** `401`（缺少 / 无效 / 过期 Token）

---

## 安全性设计

### 密码存储

- 使用 **bcryptjs** 进行密码哈希，盐值轮数（salt rounds）为 **12**
- 原始密码仅在登录请求的内存中存在，**永不写入磁盘或日志**
- 哈希值存储在 `users.json` 中，攻击者即使获取文件也无法逆向出明文密码

### 认证机制

- 采用 **JWT（JSON Web Token）** 无状态认证
- Token 有效期 **24 小时**，到期后客户端需重新登录
- JWT payload 仅包含 `id` 和 `username`，**不包含敏感信息**（密码、邮箱）
- Token 经由 HMAC-SHA256 签名，签名密钥由环境变量 `JWT_SECRET` 控制（生产环境必须设置）

### 输入验证

| 字段 | 规则 | 说明 |
|------|------|------|
| 用户名 | 3–20 位字母、数字、下划线 | 防止特殊字符注入 |
| 邮箱 | 标准 email 格式正则校验 | 防止格式错误 |
| 密码 | ≥ 8 个字符 | 防止弱密码 |
| 登录标识符 | 非空校验 | 用户名或邮箱 |

所有输入验证在服务端执行，客户端校验仅作为用户体验辅助。

### CORS

- 服务端配置 CORS，**仅允许受信任的来源**（开发环境：`http://localhost:5173`）
- 生产环境应限制为具体域名，不开启通配符（`*`）

### Token 存储

- 客户端 Token 存储在 **localStorage**，前缀 `nltype:auth:token`
- 每次请求通过 `Authorization: Bearer <token>` 请求头发送
- **安全提示：** 当前采用 localStorage 存储，存在 XSS 风险。生产环境建议升级为 httpOnly Cookie + CSRF Token 方案

### API 错误处理

- 所有端点返回一致的错误格式：`{ "error": "描述信息" }`
- 认证失败统一返回 `401`，不区分"用户不存在"和"密码错误"，防止用户名枚举攻击
- 内部错误不向客户端暴露堆栈信息

### 数据存储安全

- 用户数据存储在 JSON 文件（`apps/server/data/users.json`），开发阶段可用
- **生产环境规划：** 迁移至 PostgreSQL，密码哈希仍使用 bcrypt，连接使用 TLS

### 未来改进计划

| 项目 | 优先级 | 说明 |
|------|--------|------|
| 速率限制（Rate Limiting） | 高 | 防止暴力破解登录/注册接口 |
| httpOnly Cookie | 高 | 替代 localStorage 存储 Token，降低 XSS 风险 |
| CSRF Token | 高 | 配合 Cookie 使用，防止跨站请求伪造 |
| 数据库迁移 | 中 | 从 JSON 文件迁移至 PostgreSQL |
| 密码复杂度策略 | 中 | 大小写 + 数字 + 特殊字符组合要求 |
| 登录失败锁定 | 中 | 连续失败 N 次后临时锁定账户 |
| HTTPS | 高 | 全站 TLS 加密，防止中间人攻击 |
| 日志审计 | 低 | 记录登录/注册事件用于安全分析 |

---

## 设计文档

- [前端设计文档](/docs/frontend-design.md) — 视觉风格、组件架构、可扩展性设计
- [游戏设计文档](/docs/game-design.md) — 单人/多人模式、房间系统、UI/UX
- [项目计划书](/docs/multiplayer-typing-game-plan.md) — 技术选型、架构设计、开发路线

---

## 开发路线

```
Phase 1 — MVP (已完成)
  ✅ 单人打字练习（计时 / 禅 / 单词 / 引用模式）
  ✅ 多语言支持（EN / ZH / Code）
  ✅ 即时统计（WPM / 准确率 / 进度）
  ✅ 暗色/亮色主题
  ✅ 本地成绩榜
  ✅ 用户认证（注册 / 登录 / JWT 会话）

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

- 代码中所有中文 UI 文本使用 **Unicode 跳脱序列**（`\uXXXX`）避免编码问题
- 前端构建产物（`dist/`）不提交
- `.tools/` 目录为本地 Go 工具链，每台机器单独下载，不提交
- 所有文档示例使用占位符，不写真实凭据
- 密码等敏感信息通过环境变量注入，不硬编码

---

> 项目状态：Alpha — 单人模式可用，认证系统已接入，多人模式开发中
