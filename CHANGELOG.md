# NLType 实现进度

> 每次实现新功能时更新此文件。
>
> 格式：`[日期] 实现/新增/修复/重构 + 简短描述`

---

### 2026-07-12

- **重构**: 词库文件按语言分类
  - 服务端: data/words.json -> data/en/words.json
  - 服务端: data/chinese.json -> data/zh/texts.json
  - 客户端: src/data/words.ts -> src/data/en.ts
  - 客户端: src/data/chinese.ts -> src/data/zh.ts
- **规划**: 新增词库上传功能


## 规划功能 — 词库管理

### 词库上传

允许用户和管理员通过 Web 界面上传自定义词库。

**API**:

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/texts | GET | 列出所有可用词库 |
| /api/texts/upload | POST | 上传词库文件 |
| /api/texts/:id | DELETE | 删除词库 |

**上传流程**:

用户上传 TXT/CSV/JSON 文件
  1. 服务端校验格式和内容
  2. 写入 data/{lang}/{uuid}.json
  3. 更新 data/index.json (词库清单)
  4. 返回词库 ID

**目录结构**:

apps/server/data/
  index.json         词库清单 (id/名称/语言/类型/条目数/上传者/时间)
  en/
    default.json     内置英文词库 (470 词)
    ...用户上传
  zh/
    texts.json       内置中文语段 (50 条)
    ...用户上传
  ja/                未来
  ko/                未来

**管理功能** (Phase 3):
- 管理员后台: 浏览/删除/禁用词库
- 用户个人页: 查看已上传的词库



## Phase 1 — MVP（单人模式）

### 2026-07-05

- **实现**: 项目计划书 `docs/multiplayer-typing-game-plan.md`
- **实现**: 游戏设计文档 `docs/game-design.md`

### 2026-07-08

- **搭建**: Monorepo 项目结构（pnpm workspace + Turborepo）
- **搭建**: React + Vite + TypeScript + TailwindCSS 前端脚手架
- **实现**: 单人计时模式（15s / 30s / 60s / 120s）
- **实现**: 英文词库（470 常用单词）
- **实现**: 中文语段库（50 条诗句/名言）
- **实现**: 核心打字引擎 `useTypingEngine`（WPM / 准确率 / CPM 实时计算）
- **实现**: 倒计时器 `useTimer`
- **实现**: 中英文切换（语言切换按钮）
- **实现**: 双行交替显示（预期行 + 输入行）
- **实现**: 暗色主题 UI（TailwindCSS 自定义色系）
- **实现**: Backspace 回退支持
- **实现**: 结果页（WPM / 准确率 / CPM / Raw WPM / 字符统计）
- **实现**: 文本 API 服务（Node.js text-server.mjs → 提供 `/api/text/english` 和 `/api/text/chinese`）
- **搭建**: Go 语言后端项目（Go 1.22.5 + `net/http` 标准库）
- **更换**: 文本服务器从 Node.js 切换到 Go 单文件二进制
- **实现**: Go 后端根路径 API 信息页（`localhost:3001/`）
- **实现**: Go 后端健康检查端点 `/api/health`
- **实现**: 一键启动脚本 `start.bat`
- **实现**: `.gitignore` + `README.md`

### 2026-07-09

- **实现**: 打字结果显示组件 `TypingDisplay`（可复用）
- **实现**: 文本数据移到后端（JSON 文件 → Go API）
- **实现**: 前端优先从后端 API 获取文本，自动降级到本地数据
- **修改**: 输入逻辑改为接受任意字符（不再忽略非匹配按键）
- **修复**: 光标跟随（从绝对定位改为文本流光标）
- **修复**: 准确率计算（退格不减计数，错误记录永久保留）
- **修复**: 两行显示布局（每行预期文本后紧跟输入行）
- **修复**: 中文字符编码问题（改用 Unicode 跳脱序列 `\uXXXX`）
- **修复**: 中文 IME 输入支持（隐藏 textarea + composition 事件）
- **修复**: `hasChineseRef` 在语言切换后不更新的 bug
- **修复**: `typedPos` 越界导致 UI 崩溃的 bug
- **修复**: 文本全部输入完毕后无响应的 bug（自动弹出结果页）
- **修复**: textarea 焦点丢失导致输入法不工作的 bug

### 2026-07-10

- **实现**: 项目计划书 v2（Go 后端版，整合技术评审建议）
- **更新**: 项目计划书新增第六节"项目目录结构设计"
- **实现**: 实现进度文档 `CHANGELOG.md`
- **清理**: 删除一次性修复脚本（`scripts/` 目录）

---

## 已实现的 API 端点

| 端点 | 说明 | 状态 |
|------|------|------|
| `GET /api/health` | 健康检查 | ✅ |
| `GET /api/text/english` | 随机英文文本（200 字符） | ✅ |
| `GET /api/text/chinese` | 随机中文文本 | ✅ |

---

## 项目结构

```
NLtyping/
├── apps/
│   ├── client/              # React 前端
│   │   └── src/
│   │       ├── components/
│   │       │   ├── TypingGame.tsx      # 主游戏组件
│   │       │   └── TypingDisplay.tsx   # 打字显示组件
│   │       ├── hooks/
│   │       │   ├── useTypingEngine.ts  # 打字引擎
│   │       │   └── useTimer.ts         # 倒计时器
│   │       └── data/
│   │           ├── words.ts            # 英文词库
│   │           └── chinese.ts          # 中文语段
│   └── server/              # Go 后端
│       ├── cmd/server/      # 入口
│       ├── data/            # 词库 JSON
│       └── go.mod
├── packages/shared/         # 共享类型
├── docs/                    # 文档
├── start.bat                # 一键启动
└── README.md
```

---

## 启动方式

```powershell
# 方式一：一键启动
.\start.bat

# 方式二：分别启动
# 终端 1：Go 后端
cd apps\server
set PORT=3001
server.exe

# 终端 2：前端
cd apps\client
npx vite --host
```

访问 http://localhost:5173/
