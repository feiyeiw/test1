# Cloudflare KV 博客存储部署指南

本指南将帮助您将网站博客数据从本地存储（localStorage）迁移到 Cloudflare Workers KV，实现跨设备、跨用户共享博客内容。

## 📋 前提条件

1. **Cloudflare 账户** - 已有或新注册
2. **已部署的网站** - 当前网站已部署到 Cloudflare Pages
3. **Wrangler CLI**（可选）- 用于本地测试

## 🚀 部署步骤

### 步骤 1：创建 KV 命名空间

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择您的账户和 Pages 项目
3. 转到 **Workers & Pages** → **KV**
4. 点击 **Create a namespace**
5. 命名空间名称：`BLOG_DATA`
6. 点击 **Add**

记下命名空间 ID（如：`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`）

### 步骤 2：配置 Pages 项目

1. 在您的 Pages 项目中，转到 **Settings** → **Functions**
2. 在 **KV namespace bindings** 部分，点击 **Add binding**
3. 配置如下：
   - **Variable name**: `BLOG_DATA`
   - **KV namespace**: 选择刚才创建的 `BLOG_DATA`
4. 点击 **Save**

### 步骤 3：设置环境变量

1. 在 Pages 项目设置中，转到 **Settings** → **Environment variables**
2. 添加生产环境变量：
   - **Variable name**: `API_KEY`
   - **Value**: 生成一个安全的随机字符串（如使用 `openssl rand -hex 32`）
   - **Environment**: Production
3. 点击 **Save**

### 步骤 4：部署 Functions

您的 `functions/` 目录已经包含 API 代码。提交到 Git 后，Cloudflare Pages 会自动检测并部署 Functions：

```bash
git add .
git commit -m "添加 Cloudflare KV 博客存储功能"
git push origin main
```

部署完成后，API 将可通过以下端点访问：
- `https://your-domain.pages.dev/api/blogs`
- `https://your-domain.pages.dev/api/blogs/:id`

## 🔧 配置前端

### 方法 A：通过浏览器控制台（简单）

1. 打开网站的管理员页面 (`/admin.html`)
2. 打开浏览器开发者工具（F12）
3. 在控制台中执行：

```javascript
// 启用 Cloudflare KV API
localStorage.setItem('blogApiConfig', JSON.stringify({
    enabled: true,
    endpoint: '/api/blogs', // 相对于当前域名
    apiKey: '您的-API-密钥', // 与步骤3中设置的一致
    useLocalStorageFallback: true
}));

// 重新加载页面
location.reload();
```

### 方法 B：通过管理员面板配置界面（推荐 - 现已实现）

现在您可以通过管理员面板的图形界面配置 Cloudflare KV API：

1. 打开网站的管理员页面 (`/admin.html`)
2. 登录后，向下滚动到 **API Configuration** 部分
3. 配置选项：
   - **Enable Cloudflare KV API**: 启用/禁用 API 模式
   - **API Endpoint**: API 端点路径（默认 `/api/blogs`）
   - **API Key**: 您的 Cloudflare Pages 环境变量中的 API 密钥
   - **Use localStorage fallback**: 启用本地存储回退（推荐）
4. 点击 **Test Connection** 测试 API 连接
5. 点击 **Save API Configuration** 保存配置

**数据迁移功能**：
- 如果您有现有的本地博客，系统会自动检测并显示迁移选项
- 点击 **Migrate to Cloudflare KV** 将本地博客迁移到云端
- 迁移过程会显示每个博客的迁移状态

## 📊 数据迁移

### 迁移现有博客到 KV

在浏览器控制台中执行：

```javascript
// 获取本地博客数据
const localBlogs = JSON.parse(localStorage.getItem('blogs')) || [];

// 通过 API 导入到 KV
localBlogs.forEach(async (blog) => {
    try {
        const response = await fetch('/api/blogs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': '您的-API-密钥'
            },
            body: JSON.stringify(blog)
        });

        if (response.ok) {
            console.log(`博客 "${blog.title}" 导入成功`);
        } else {
            console.error(`博客 "${blog.title}" 导入失败:`, await response.text());
        }
    } catch (error) {
        console.error(`博客 "${blog.title}" 导入错误:`, error);
    }
});
```

## 🧪 测试 API

### 测试连接

```bash
# 测试 GET 端点（公开）
curl https://your-domain.pages.dev/api/blogs

# 测试 POST 端点（需要 API 密钥）
curl -X POST https://your-domain.pages.dev/api/blogs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 您的-API-密钥" \
  -d '{"title":"测试博客","content":"<p>测试内容</p>","date":"2024-12-01"}'
```

### 健康检查

```
GET https://your-domain.pages.dev/api/health
```

## 🔒 安全注意事项

1. **保护 API 密钥**
   - 不要在代码中硬编码 API 密钥
   - 使用环境变量存储
   - 定期轮换密钥

2. **输入验证**
   - API 已内置基本验证
   - 确保博客内容安全（避免 XSS）

3. **CORS 配置**
   - API 已配置为允许所有来源（`*`）
   - 生产环境可限制为特定域名

## ⚠️ 故障排除

### 问题：API 返回 401 错误
- 检查 API 密钥是否正确配置
- 确认请求头包含 `X-API-Key`
- 验证环境变量已正确设置

### 问题：无法访问 KV 存储
- 确认 KV 命名空间绑定正确
- 检查命名空间 ID 是否正确
- 确认 Functions 有权限访问 KV

### 问题：博客数据显示延迟
- KV 读取可能有轻微延迟（通常 <10ms）
- 启用 localStorage 回退可改善用户体验

## 🔄 维护

### 查看 KV 存储内容

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 列出所有博客
wrangler kv:key list --namespace-id=您的命名空间ID --prefix="blog:"

# 获取特定博客
wrangler kv:key get "blog:1" --namespace-id=您的命名空间ID
```

### 备份数据

定期导出 KV 数据：

```bash
# 获取所有键值
wrangler kv:key list --namespace-id=您的命名空间ID --json > kv-backup.json

# 批量导出值
# （需要编写脚本循环获取每个键的值）
```

## 📈 监控

1. **Cloudflare Dashboard** → **Workers & Pages** → 您的项目
   - 查看请求量、错误率
   - 监控响应时间

2. **KV 使用情况**
   - 存储空间使用情况
   - 读写操作次数

## 🔮 未来改进

1. **✓ 管理员配置界面** - 已在管理员面板中实现 API 配置界面
2. **数据版本控制** - 添加博客版本历史
3. **图片存储** - 将博客图片也存储到 KV 或 R2
4. **评论系统** - 基于 KV 的简单评论功能
5. **缓存优化** - 更智能的缓存策略
6. **批量操作** - 批量导入/导出博客数据
7. **搜索功能** - 基于 KV 的全文搜索
8. **访问统计** - 博客阅读次数统计

## 🆘 获取帮助

- Cloudflare 官方文档：https://developers.cloudflare.com/kv/
- 问题反馈：在 GitHub 仓库创建 Issue
- 社区支持：Cloudflare Community Forums

---

**注意**：首次部署后，请先测试 API 功能，确认数据能正确存储和读取，再切换前端配置。