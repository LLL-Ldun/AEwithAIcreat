# AIEDIT — AE AI特效生成插件 设计文档

## 概述

After Effects CEP 窗口插件。用户截取视频当前帧，用自然语言描述效果，AI 生成带特效的图片并让效果动起来，最终导入 AE 合成末尾。

## 架构

```
┌─────────── AE Application ───────────┐
│                                       │
│  ┌──── CEP Panel (CEF Browser) ────┐ │
│  │  截图预览  │  提示词  │  结果    │ │
│  │  CSInterface.js ←→ ExtendScript │ │
│  └────────────────┬────────────────┘ │
│                   │                   │
│  ┌────────────────▼────────────────┐ │
│  │  host/*.jsx                     │ │
│  │  导出帧 / 导入素材 / 操作合成   │ │
│  └─────────────────────────────────┘ │
└──────────────────┬───────────────────┘
                   │ HTTP (fetch)
     ┌─────────────┼─────────────┐
     ▼              ▼              ▼
┌─────────┐  ┌──────────┐  ┌──────────┐
│ Agnes   │  │Replicate │  │  ...其他  │
│ 图生图  │  │ 图生图   │  │          │
│ 图生视频│  │ 图生视频 │  │          │
└─────────┘  └──────────┘  └──────────┘
```

CEP 面板通过内置 CEF 浏览器的 `fetch` API 直接调用云端服务，无中间服务器。

## 核心决策

| 项 | 决策 |
|----|------|
| 架构 | CEP 面板直接调 API（fetch），无中间服务 |
| 工作流 | 管线式：截图 → 生成效果图 → 让图动起来 |
| 面板布局 | 纵向三面板，每步独立预览+操作+重做 |
| API Key | 面板设置图标输入，存 CEP 本地持久化存储 |
| 导入位置 | 生成结果追加到合成末尾 |
| 效果类型 | 不作限制，由用户自然语言描述决定 |
| API | 两个环节独立选服务商：图生图可选 Agnes/Replicate 等，图生视频可选 Agnes/Replicate 等 |
| 代码模块 | `<script>` 标签按依赖加载，IIFE 模式，全局变量共享 |
| Git | 仓库 https://github.com/LLL-Ldun/AEwithAIcreat |

## 数据流

### 步骤 1：截取当前帧

```
用户点击"截取当前帧"
  → app.js 通过 CSInterface.evalScript() 调用 exportFrame.jsx
  → exportFrame.jsx 获取当前合成、当前时间指示器位置
  → 设置 renderQueue 导出单帧 PNG 到临时目录
  → 返回 PNG 文件路径给前端
  → 前端加载图片显示在截图预览区
```

### 步骤 2：生成效果图

```
用户输入自然语言描述，点击"生成效果图"
  → app.js 读取截图 PNG 转 base64
  → api.js 根据用户选择的图生图服务商调用对应 API：

     Agnes: POST /v1/images/generations
            model: agnes-image-2.0-flash
            tags: ["img2img"]
            prompt + image (base64)

     Replicate / 自定义: 各自对应的端点格式

  → 轮询等待/直接获取生成的效果图
  → 显示在效果图预览区
```

### 步骤 3：让效果动起来

```
用户点击"生成动画视频"
  → api.js 根据用户选择的图生视频服务商调用对应 API：

     Agnes: POST /v1/videos (创建任务)
            model: agnes-video-v2.0
            prompt + image (base64)
            num_frames: 满足 8n+1 (81/121/161/241)
            → GET /v1/videos/{task_id} 轮询至 status: "completed"

     Replicate / 自定义: 各自对应的端点格式

  → 下载视频到临时目录
  → app.js 调用 importToComp.jsx
  → importToComp.jsx 导入视频并添加到合成末尾
```

## 面板 UI

纵向三面板布局（300-400px 宽，适合 AE 右侧停靠）：

- **第1步 · 截图**：预览区 + "截取当前帧"按钮
- **第2步 · 生成效果图**：预览区 + 提示词输入框 + 预设效果快捷标签 + "生成效果图"按钮
- **第3步 · 生成视频**：预览区 + "生成动画视频"按钮 + "导入到合成末尾"按钮
- **设置入口**：面板顶部小齿轮图标，弹出配置区，两个环节独立配置：

  **图生图配置：**
  - 服务商下拉选择（Agnes / Replicate / 自定义）
  - Base URL 输入框
  - API Key 输入框
  - Endpoint 路径输入框（如 `/v1/images/generations`）
  - 模型名称输入框（如 `agnes-image-2.0-flash`）

  **图生视频配置：**
  - 服务商下拉选择（Agnes / Replicate / 自定义）
  - Base URL 输入框
  - API Key 输入框
  - Endpoint 路径输入框（如 `/v1/videos`）
  - 模型名称输入框（如 `agnes-video-v2.0`）

  - 所有配置项存入 CEP 本地持久化存储

## 项目文件结构

```
AIEDIT/
├── .gitignore                  # node_modules, 临时输出文件
├── CSXS/
│   └── manifest.xml            # CEP 扩展清单
├── client/
│   ├── index.html              # 面板主界面（三面板纵向布局）
│   ├── style.css               # AE 暗色主题样式
│   ├── app.js                  # 主逻辑：CSInterface + 面板交互 + 状态管理
│   ├── api.js                  # API 抽象层：支持多服务商（Agnes/Replicate/自定义）
│   └── settings.js             # API Key 配置面板逻辑
├── host/
│   ├── exportFrame.jsx         # 导出当前帧为 PNG
│   ├── importToComp.jsx        # 导入素材到合成末尾
│   └── lib.jsx                 # 公共工具函数
└── README.md
```

## 关键约束

- CEP 内置 CEF 浏览器版本较低（约 Chrome 66），不支持 ES Module
- JS 文件通过 `<script>` 标签按依赖顺序加载，使用 IIFE 暴露全局变量
- API Key 通过 `cep.fs` 持久化存储到 AE 扩展私有目录，不写入项目文件
- ExtendScript 为旧式 ES3 方言，无 `let`/`const`/箭头函数

## 验证方式

1. AE 中 `Window > Extensions > AIEDIT` 面板可打开，三面板布局正确
2. 截图按钮可导出当前帧 PNG，预览正确显示
3. 选择的图生图服务商 API 调用成功，效果图生成并预览
4. 选择的图生视频服务商 API 调用成功，视频生成并下载
5. 切换不同服务商亦可正常工作
5. 视频导入 AE 合成末尾，可正常播放
