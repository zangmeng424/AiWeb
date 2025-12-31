# AI Agent 本地交互系统 🚀

## 项目简介
**AI Agent 本地交互系统** 是一个基于 Flask 的轻量级 Web 平台，提供本地/远程大模型接入、知识库检索、工具（MCP）调用。系统支持 SSE 实时流式回复、会话管理、知识库（向量检索）与模型管理，适合本地部署与二次开发。

---

## 项目特点 ✨
- **Web 前端 UI**：友好的单页交互界面（`templates/index.html`），支持对话管理、模型配置、知识库管理、MCP 工具配置与终端
- **SSE 流式对话**：通过 `/api/chat` 提供流式（Server-Sent Events）对话响应，支持工具调用与知识库增强
- **本地知识库**：基于 FAISS + SentenceTransformer 实现向量检索（`module/repository`），实现了AI自动更新知识库
- **MCP 工具集成**：可在UI中配置 MCP Server 服务
- **多模型接入**：支持openai格式云端大预言模型接入，可在 UI 中管理模型
- **后台任务与终端**：内置可在后台执行 shell 命令的终端（`/terminal`），并可查看命令流式输出
- **MySQL + Redis**：使用 MySQL 存储会话和模型信息；Redis 用于缓存会话配置以提高性能
- **日志管理**：使用 `loguru` 写日志到 `logs/app.log`，每天轮转，保留 30 天

---

## 快速开始（Windows）💡

### 1. 克隆项目,创建虚拟环境并安装依赖
```bash
cd aiweb
uv venv --python=3.12 .venv
.venv\Scripts\activate  
uv pip install -r requirements.txt
```

### 2. 配置数据库与 Redis
- 导入数据库 `aiweb.sql`
- 编辑 `config_dev.py`，将配置调整为你的 MySQL/Redis 实例

### 3. 本地向量模型与 embedding
- 安装[bge-small-zh-v1.5模型](https://www.modelscope.cn/models/AI-ModelScope/bge-small-zh-v1.5)到项目根目录
- embedding模型路径配置在 `config_dev.py` 的 `embedding = "./bge-small-zh-v1.5"` 


### 4. 启动应用
```bash
uv run python app.py
```
- 默认 Flask 以 debug 模式运行（本地调试）。访问： http://127.0.0.1:5000

---

## 注意事项 & 排错 ⚠️
- 确保 MySQL 与 Redis 已启动并正确配置在 `config_dev.py` 中
- 在使用node编写的MCP Server前请确认nodejs环境已存在，系统不会自动配置nodejs环境
- MCP 工具不会自动存在，你需要在中配置可启动的 MCP 子进程并确保相应服务可用
- 若功能存在异常，检查浏览器控制台与 Flask 日志（`logs/app.log`）
