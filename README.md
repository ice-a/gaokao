# 高考志愿填报分析系统

基于 Node.js + Express + MongoDB + AI 的高考志愿填报分析系统，帮助考生根据分数、省份、意向行业等条件智能推荐高校。

## 功能特性

- 📊 **智能志愿分析** - 输入分数自动匹配冲/稳/保三档高校
- 🏫 **高校库浏览** - 2900+ 高校数据，支持多维度筛选
- 🏭 **行业筛选** - 按意向行业筛选学校和热门专业
- 🤖 **AI 分析报告** - 调用 LLM 生成录取概率、就业前景等分析
- 🌐 **最新招生信息** - 一键获取学校最新招生计划和分数线
- ⚖️ **高校对比** - 多所学校横向对比，AI 对比分析
- 📈 **数据统计** - 省份分布、主管部门等可视化图表
- 🔐 **访问密码保护** - 防止滥用

## 技术栈

- **后端**: Node.js + Express
- **前端**: EJS 模板 + Tailwind CSS
- **数据库**: MongoDB
- **AI**: OpenAI 兼容 API

## 快速开始

### 1. 安装依赖

```bash
cd node_app
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填写配置：

```bash
cp .env.example .env
```

`.env` 配置项：

| 变量 | 说明 | 示例 |
|------|------|------|
| `MONGO_URI` | MongoDB 连接地址 | `mongodb://localhost:27017` |
| `MONGO_DB` | 数据库名称 | `gaokaodb` |
| `LLM_API_KEY` | AI API Key | `sk-xxx` |
| `LLM_API_BASE` | AI API 地址 | `https://api.openai.com/v1` |
| `LLM_MODEL` | 模型名称 | `gpt-4o-mini` |
| `SITE_PASSWORD` | 访问密码 | `your_password` |
| `PORT` | 服务端口 | `3000` |

### 3. 启动服务

```bash
npm start
```

访问 http://localhost:3000

## 页面说明

| 页面 | 路径 | 功能 |
|------|------|------|
| 志愿分析 | `/` | 输入分数、省份、行业，AI 分析推荐 |
| 高校库 | `/schools` | 浏览筛选所有高校 |
| 高校详情 | `/schools/:id` | 查看学校详情、分数线、行业专业 |
| 数据统计 | `/stats` | 省份分布、主管部门统计 |
| 高校对比 | `/compare` | 多所学校对比分析 |

## 项目结构

```
node_app/
├── app.js              # 主入口
├── config.js           # 配置
├── package.json        # 依赖
├── .env.example        # 环境变量模板
├── public/
│   └── css/style.css   # 样式
├── routes/
│   ├── index.js        # 首页路由
│   ├── schools.js      # 高校库路由
│   ├── stats.js        # 统计路由
│   └── compare.js      # 对比路由
├── services/
│   ├── db.js           # 数据库服务
│   └── llm.js          # AI 服务
└── views/
    ├── index.ejs       # 首页
    ├── result.ejs      # 分析结果
    ├── schools.ejs     # 高校列表
    ├── detail.ejs      # 高校详情
    ├── stats.ejs       # 统计页
    ├── compare.ejs     # 对比页
    ├── login.ejs       # 登录页
    ├── nav.ejs         # 导航栏
    └── 404.ejs         # 404页
```

## 数据迁移

使用 `migrate.py` 迁移数据到远程数据库：

```bash
set TARGET_URI=mongodb://user:password@host:port
python migrate.py
```

## 许可

MIT
