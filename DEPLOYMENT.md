# 部署指南 - 1³ Machine 网站

## 概述
本项目支持两种部署模式：
1. **纯静态模式**: 仅部署前端文件，使用本地JSON存储博客
2. **完整模式**: 部署前端 + Cloudflare Workers API，支持跨设备同步

## 快速开始（纯静态模式）

### 1. 构建网站
```bash
npm run build
# 或
node build.js
```

构建输出在 `dist/` 目录。

### 2. 部署到GitHub Pages
1. 推送代码到GitHub仓库
2. 仓库设置 → Pages → 构建和部署 → 源 → GitHub Actions
3. 或选择 `main` 分支 `/dist` 目录

访问: `https://[username].github.io/[repository]`

### 3. 部署到其他静态托管
- **Netlify**: 拖放 `dist/` 目录到Netlify
- **Vercel**: `vercel --prod`
- **Cloudflare Pages**: 连接GitHub仓库，构建命令 `npm run build`，输出目录 `dist`

## 完整部署（支持跨设备同步）

### 1. 准备工作
1. 注册 [Cloudflare](https://dash.cloudflare.com/) 账户
2. 安装 Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```

### 2. 创建KV命名空间
```bash
# 登录Cloudflare
wrangler login

# 创建KV命名空间用于博客存储
wrangler kv:namespace create "BLOG_DATA"
# 输出类似: {"id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "title": "BLOG_DATA"}

# 创建预览命名空间（开发用）
wrangler kv:namespace create "BLOG_DATA" --preview
```

### 3. 配置 Workers
1. 复制KV命名空间ID到 `wrangler.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "BLOG_DATA"
   id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # 替换为你的ID
   ```

2. 设置API密钥（可选但推荐）:
   ```toml
   [vars]
   API_KEY = "your-secret-api-key-here"
   ```

### 4. 部署 Workers
```bash
# 测试部署
wrangler dev

# 正式部署
wrangler deploy
```

部署成功后获得Workers URL: `https://1cube-machine-blog-api.[your-subdomain].workers.dev`

### 5. 部署前端到 Cloudflare Pages
1. Cloudflare控制台 → Workers & Pages → 创建应用 → Pages
2. 连接到GitHub仓库
3. 构建设置:
   - 构建命令: `npm run build`
   - 输出目录: `dist`
4. 部署

### 6. 配置自定义域名（可选）
1. 为Pages配置域名
2. 为Workers配置相同域名
3. 设置路由规则将 `/api/*` 转发到Workers

## 环境变量配置

### Workers 环境变量
- `API_KEY`: API认证密钥（管理操作需要）
- 在Cloudflare控制台 → Workers → 设置 → 变量中配置

### 前端配置
- API基础URL: 默认为 `/api`（相对路径）
- 可在 `script.js` 中修改 `API_CONFIG.baseUrl`

## 管理后台配置

### 1. 默认管理员账户
- 用户名: `admin`
- 密码: `admin123`
- 首次登录后建议修改密码

### 2. API密钥配置
1. 访问 `https://your-domain.com/admin.html`
2. 登录管理员账户
3. 在"跨设备同步设置"区域:
   - 输入Workers的API密钥
   - 点击"保存API密钥"
   - 点击"测试API连接"验证

### 3. 数据迁移
1. 现有博客在 `blogs.json` 文件中
2. 在管理后台点击"同步到远程"上传所有博客
3. 或使用"导入博客JSON"功能

## 维护和更新

### 更新网站内容
1. 编辑HTML/CSS/JS文件
2. 运行 `npm run build`
3. 重新部署 `dist/` 目录

### 更新API
1. 编辑 `functions/` 目录中的文件
2. 运行 `wrangler deploy`

### 备份数据
1. 从管理后台点击"导出博客JSON"
2. 或直接从Cloudflare KV导出:
   ```bash
   wrangler kv:key get --namespace-id=YOUR_NAMESPACE_ID "blog:*"
   ```

## 故障排除

### API连接失败
1. 检查Workers是否运行: `wrangler tail`
2. 检查API密钥是否匹配
3. 检查CORS设置（已在 `_middleware.js` 中配置）

### 博客不显示
1. 检查浏览器控制台错误
2. 验证 `blogs.json` 格式正确
3. 检查KV存储是否有数据

### 管理操作失败
1. 确认已登录管理员账户
2. 确认API密钥已配置且正确
3. 检查网络连接

## 安全建议
1. **修改默认密码**: 首次登录后立即修改管理员密码
2. **使用强API密钥**: 生成随机的API密钥
3. **限制CORS来源**: 生产环境建议限制CORS来源
4. **启用HTTPS**: 所有部署都应使用HTTPS
5. **定期备份**: 定期导出博客数据备份

## 支持
- 项目文档: [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)
- 问题反馈: GitHub Issues
- 联系方式: nathan180533@gmail.com