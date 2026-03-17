# 1³ Machine 网站项目总结

## 项目概述
这是一个静态企业网站，展示自动化生产和智能仓库解决方案。网站名称为"1³ Machine"，专注于为中国制造商提供自动化生产线、包装系统和智能仓库解决方案。

## 核心功能

### 1. 网站页面
- **首页** (`index.html`): 展示公司产品、服务和最新见解
- **服务** (`services.html`): 详细服务项目介绍
- **解决方案** (`solutions.html`): 行业解决方案展示
- **关于我们** (`about.html`): 公司介绍、价值观和团队信息
- **见解/博客** (`insights.html`): 技术文章和行业见解
- **博客详情** (`blog-detail.html`): 单篇博客文章详情页面
- **联系我们** (`contact.html`): 联系方式表单
- **登录** (`login.html`): 管理员登录页面
- **管理后台** (`admin.html`): 博客内容管理系统

### 2. 博客系统
- **混合存储架构**: 支持跨设备访问的混合存储方案
  - **Cloudflare KV**: 主存储，支持跨设备同步
  - **本地JSON文件**: 备用数据源 (`blogs.json`)
  - **浏览器缓存**: localStorage 提供离线访问和性能优化
- **智能数据流**:
  - 优先从远程KV API获取数据
  - 失败时回退到本地JSON文件
  - 最终回退到localStorage缓存
  - 数据自动缓存，5分钟有效期
- **管理功能**: 管理员可以通过后台添加、编辑、删除博客文章
  - 支持远程同步操作
  - 支持本地离线编辑
  - 提供数据导入/导出功能
- **跨设备支持**: 通过Cloudflare KV实现数据跨设备同步
- **离线支持**: 浏览器localStorage提供完整的离线访问和编辑能力

### 3. 缓存破坏机制
- **构建时哈希**: 使用 `build.js` 对CSS、JS等静态文件生成内容哈希
- **自动更新**: HTML文件中引用自动更新为哈希版本文件名
- **解决缓存**: 确保用户总是获取最新版本的文件

### 4. 响应式设计
- 使用CSS Grid和Flexbox布局
- 移动设备友好的导航菜单
- 自适应容器和网格系统

## 技术栈

### 前端技术
- **HTML5**: 语义化标签和现代结构
- **CSS3**: 自定义样式、响应式设计
- **JavaScript**: 客户端功能、博客API
- **Web Crypto API**: 用于登录认证的SHA-256哈希

### 构建工具
- **Node.js**: 构建脚本运行环境
- **build.js**: 自定义构建脚本，处理文件复制和哈希生成

### 数据存储
- **Cloudflare KV**: 主存储，支持跨设备同步的键值存储
- **JSON文件**: `blogs.json` 备用数据源和初始数据
- **localStorage**: 浏览器本地缓存，提供离线支持
- **Cloudflare Workers**: 无服务器API层，处理博客CRUD操作
- **GitHub**: 代码版本控制和部署

## 文件结构

```
项目根目录/
├── 页面文件/
│   ├── index.html          # 主页
│   ├── about.html          # 关于页面
│   ├── services.html       # 服务页面
│   ├── solutions.html      # 解决方案页面
│   ├── insights.html       # 博客列表页面
│   ├── blog-detail.html    # 博客详情页面
│   ├── contact.html        # 联系页面
│   ├── login.html          # 登录页面
│   └── admin.html          # 管理后台页面
├── 样式和脚本/
│   ├── style.css           # 主样式文件
│   └── script.js           # 主JavaScript文件
├── 数据文件/
│   └── blogs.json          # 博客数据存储（备用数据源）
├── Cloudflare Functions/
│   ├── _middleware.js      # API中间件（CORS处理）
│   ├── api/
│   │   ├── blogs.js        # 博客列表API（GET/POST）
│   │   ├── blogs/[id].js   # 单个博客API（GET/PUT/DELETE）
│   │   └── health.js       # 健康检查API
│   └── wrangler.toml       # Cloudflare Workers配置
├── 构建配置/
│   ├── build.js            # 构建脚本
│   ├── package.json        # 项目配置
│   └── .gitignore          # Git忽略文件
├── 静态资源/
│   ├── logo.jpg            # 公司Logo
│   └── logo.svg            # SVG格式Logo
└── 构建输出/
    └── dist/               # 构建后的文件目录
```

## 使用方法

### 1. 本地开发
```bash
# 查看网站
直接使用浏览器打开HTML文件

# 编辑博客
修改 blogs.json 文件或使用管理后台
```

### 2. 构建网站
```bash
# 安装依赖 (如果需要)
npm install

# 运行构建脚本
npm run build
# 或
node build.js
```

构建过程会：
1. 清理 `dist/` 目录
2. 复制所有静态文件到 `dist/`
3. 为CSS、JS等文件生成内容哈希
4. 更新HTML中的文件引用
5. 输出构建后的文件到 `dist/` 目录

### 3. 部署网站

#### GitHub Pages部署
1. 将代码推送到GitHub仓库
2. 在仓库设置中启用GitHub Pages
3. 选择部署源为 `main` 分支的 `dist/` 目录
4. 访问生成的 `https://[用户名].github.io/[仓库名]`

#### Cloudflare Workers + Pages 部署（推荐）
1. **部署静态网站到 Cloudflare Pages**:
   - 将代码推送到GitHub仓库
   - 在Cloudflare控制台创建Pages项目
   - 连接到GitHub仓库，构建命令: `npm run build`
   - 发布目录: `dist`

2. **部署API到 Cloudflare Workers**:
   ```bash
   # 安装Wrangler CLI
   npm install -g wrangler

   # 登录Cloudflare
   wrangler login

   # 创建KV命名空间（第一次部署时）
   wrangler kv:namespace create "BLOG_DATA"

   # 更新wrangler.toml中的KV命名空间ID

   # 部署Workers
   wrangler deploy
   ```

3. **配置环境变量**:
   - 在Workers设置中设置 `API_KEY` 环境变量
   - 在admin管理后台输入相同的API密钥

4. **配置自定义域名**（可选）:
   - 为Pages和Workers配置相同域名
   - 设置路由规则将 `/api/*` 转发到Workers

#### 其他静态托管
- 直接将 `dist/` 目录内容上传到任何静态托管服务
- 如Netlify、Vercel、Cloudflare Pages等

### 4. 博客管理

#### 通过JSON文件管理
1. 直接编辑 `blogs.json` 文件
2. 遵循现有格式添加新博客
3. 每个博客包含:
   - `id`: 唯一标识符
   - `title`: 文章标题
   - `content`: HTML内容
   - `plainText`: 纯文本摘要
   - `date`: 发布日期
   - `createdAt`: 创建时间戳
   - `updatedAt`: 更新时间戳

#### 通过管理后台
1. 访问 `admin.html`
2. 使用预设凭据登录（默认: admin / admin123）
3. 在界面中添加、编辑或删除博客

#### 远程同步管理
1. **配置API密钥**:
   - 在管理后台的"跨设备同步设置"区域
   - 输入Cloudflare Workers的API密钥
   - 点击"保存API密钥"

2. **测试连接**:
   - 点击"测试API连接"验证配置
   - 成功显示"API连接正常"

3. **同步操作**:
   - **同步到远程**: 将本地博客上传到Cloudflare KV
   - **从远程刷新**: 从Cloudflare KV下载最新博客
   - **自动同步**: 新建/编辑/删除博客时自动同步（需API密钥）

4. **离线模式**:
   - 无API密钥或网络断开时自动使用本地存储
   - 恢复连接后可手动同步数据

### 5. 更新网站内容

#### 常规页面更新
1. 直接编辑HTML文件
2. 运行构建脚本更新 `dist/` 目录
3. 推送更改到GitHub

#### 样式更新
1. 编辑 `style.css` 文件
2. 构建后会自动生成哈希版本
3. HTML引用自动更新

## 缓存管理

### 问题
浏览器缓存可能导致用户看不到最新的网站更新。

### 解决方案
1. **文件哈希**: 构建时为每个文件生成基于内容的唯一哈希
2. **引用更新**: HTML中所有文件引用自动更新为哈希版本
3. **缓存失效**: 文件内容变化时哈希改变，强制浏览器重新下载

### 效果
- 用户总是获取最新版本
- 未更改的文件保持缓存优化
- 无需手动清除浏览器缓存

## 扩展建议

### 功能扩展
1. **搜索功能**: 实现博客内容搜索
2. **评论系统**: 添加博客评论功能
3. **多语言支持**: 添加中文/英文切换
4. **表单处理**: 联系表单后端处理

### 性能优化
1. **图片优化**: 添加图片压缩和WebP格式支持
2. **代码分割**: JavaScript按需加载
3. **CDN集成**: 静态资源CDN加速

### SEO优化
1. **元标签优化**: 更好的SEO元信息
2. **结构化数据**: 添加Schema.org标记
3. **Sitemap生成**: 自动生成网站地图

## 注意事项

### 开发注意事项
1. **构建顺序**: 修改文件后必须运行 `npm run build`
2. **哈希机制**: 仅非HTML文件添加哈希，HTML保持原文件名
3. **本地存储**: 博客编辑后需手动更新 `blogs.json` 文件

### 部署注意事项
1. **GitHub Pages**: 确保 `dist/` 目录包含所有必要文件
2. **路径问题**: 确保所有文件引用使用相对路径
3. **缓存策略**: 服务器应设置适当的缓存头

## 联系方式
- **项目名称**: 1³ Machine
- **业务范围**: 自动化生产、智能仓库解决方案
- **联系人**: Nathan
- **邮箱**: nathan180533@gmail.com
- **WhatsApp**: +86 135 1901 4301
- **地址**: 香港

---

*本总结文档为AI助手提供项目概览，方便快速了解项目结构和功能。*