# ASRS 网站重构实现计划

> **品牌名**: 13machine (1³ Machine)  
> **项目目标**: 将现有自动化生产线网站重构为 ASRS (自动化立体仓库) 专业网站  
> **日期**: 2026-04-07
> **状态**: ✅ 核心页面已完成

---

## 实施进度

| 步骤 | 任务 | 状态 | 文件 |
|------|------|------|------|
| 1 | 更新导航结构 | ✅ | index.html, style.css |
| 2 | 重构首页 | ✅ | index.html |
| 3 | 创建ASRS成本页 | ✅ | asrs-cost.html |
| 4 | 创建ASRS设计页 | ✅ | asrs-design.html |
| 5 | 重构解决方案页 | ✅ | solutions.html |
| 6 | 创建案例研究页 | ✅ | case-studies.html |
| 7 | 更新样式文件 | ✅ | style.css |
| 8 | 后端功能增强 | ✅ | script.js |
| 9 | 移动端响应式优化 | ✅ | style.css |
| 10 | SEO优化 | ⏳ | 所有页面 |
| 11 | 最终测试 | ⏳ | - |

---

## 一、项目概述

### 1.1 网站架构
根据文档要求，网站需要简化为 **5个核心页面**：

| 页面 | 文件名 | 目标 |
|------|--------|------|
| 首页 | `index.html` | 让客户发起咨询动议 |
| ASRS成本 | `asrs-cost.html` | 获得客户询盘 |
| ASRS设计 | `asrs-design.html` | 展示系统设计能力 |
| 解决方案 | `solutions.html` | 按应用场景展示方案 |
| 案例研究 | `case-studies.html` | 建立信任感 |

### 1.2 全站转化路径
```
首页 (引发兴趣) 
    ↓
ASRS成本页 (获取询盘表单)
    ↓
ASRS设计页 (展示专业能力)
    ↓
解决方案页 (匹配需求)
    ↓
案例研究页 (建立信任)
    ↓
联系表单 (转化成交)
```

---

## 二、分步实现步骤

### 步骤 1: 更新网站导航结构

**修改文件**: `index.html`, `style.css`

**导航调整**:
```
原导航: OUR PRODUCTS | SERVICES | SOLUTIONS | ABOUT US | INSIGHTS | CONTACT
新导航: Home | ASRS Cost | ASRS Design | Solutions | Case Studies | Contact
```

**实现内容**:
1. 更新所有页面的导航栏
2. 移除 SERVICES、ABOUT US、INSIGHTS 页面链接
3. 添加 ASRS Cost、ASRS Design、Case Studies 链接
4. 统一页脚导航

---

### 步骤 2: 重构首页 (index.html)

**目标**: 让客户发起咨询动议

**页面结构 (6个区块)**:

#### 区块 1: Hero 主视觉
```
标题: How Much Does an ASRS Warehouse Cost?
副标题: We help you design your system, estimate your investment, and deliver complete ASRS solutions.
按钮: [Get Cost Estimate] [View Solutions]
```

**实现代码示例**:
```html
<section class="hero">
    <div class="container">
        <h1>How Much Does an ASRS Warehouse Cost?</h1>
        <p>We help you design your system, estimate your investment, and deliver complete ASRS solutions.</p>
        <div class="hero-buttons">
            <a href="asrs-cost.html" class="btn btn-primary">Get Cost Estimate</a>
            <a href="solutions.html" class="btn btn-secondary">View Solutions</a>
        </div>
    </div>
</section>
```

#### 区块 2: 项目规模选择
```
标题: Which ASRS Project Fits You?
卡片:
  - Small Project: $300K – $800K [See Example]
  - Medium Project: $1M – $3M [See Example]
  - Large Project: $3M+ [See Example]
```

#### 区块 3: 常见问题
```
标题: Planning an ASRS Project?
列表:
  - How much will it cost?
  - What system should I choose?
  - Is the ROI worth it?
  - How long will it take?
```

#### 区块 4: 服务内容
```
标题: What We Do
项目:
  - System Design
  - Cost Estimation
  - Equipment Integration
  - Full Project Delivery
```

#### 区块 5: 真实案例
```
标题: Real ASRS Projects
展示: 图片/视频 + 文字描述
按钮: [View Case]
```

#### 区块 6: CTA行动号召
```
标题: Get Your ASRS Project Evaluation
内容: Tell us your warehouse size and requirements, we will estimate your cost and propose a solution.
按钮: [Get Free Estimate]
```

---

### 步骤 3: 创建 ASRS成本页 (asrs-cost.html)

**目标**: 获得客户询盘

**页面结构 (5个区块)**:

#### 区块 1: 成本概览
```
标题: ASRS Warehouse Cost Breakdown
数据: $50,000 – $5,000,000+
```

#### 区块 2: 价格档次
```
Small: $50K – $800K
Medium: $1M – $3M
Large: $3M+
```

#### 区块 3: 影响因素
```
- Warehouse size (length, width and height)
- Number of storage locations
- Storage unit weight/volume
- SKU
- Frequency per hour
- Automation level
```

#### 区块 4: 项目对比
```
展示3个案例:
- 小型: $500K
- 中型: $1.8M
- 大型: $4M
```

#### 区块 5: 询盘表单
```
标题: Get Your Cost Estimate
表单字段:
  - 公司名称
  - 公司所在国家和城市
  - 联系人姓名
  - 联系人电话/WhatsApp/WeChat
  - Warehouse size (length, width and height)
  - Number of storage locations
  - Storage unit weight/volume
  - SKU
  - Frequency per hour
  - Project completion timeline
按钮: [Get Estimate]
```

---

### 步骤 4: 创建 ASRS设计页 (asrs-design.html)

**目标**: 展示系统设计能力

**页面结构 (5个区块)**:

#### 区块 1: 页面标题
```
标题: How to Design an ASRS Warehouse
```

#### 区块 2: 系统类型
```
类型:
  - Stacker Crane (堆垛机)
  - Shuttle (穿梭车)
  - ACR (自动换层机器人)
  - AMR (自主移动机器人)
```

#### 区块 3: 规模匹配
```
Small → ACR
Large → Stacker
Flexible → AMR
```

#### 区块 4: 设计逻辑
```
- Storage density (存储密度)
- Throughput (吞吐量)
- Space utilization (空间利用率)
```

#### 区块 5: CTA
```
标题: Need help choosing your system?
按钮: [Contact us]
```

---

### 步骤 5: 重构解决方案页 (solutions.html)

**目标**: 按应用场景展示方案

**页面结构 (4个区块)**:

#### 区块 1: 页面标题
```
标题: ASRS Solutions by Application
```

#### 区块 2: 应用场景
```
场景:
  1. E-commerce warehouse (电商仓储)
  2. Manufacturing (制造业)
  3. Cold storage (冷链仓储)
  4. Spare parts (备件仓储)

每个场景包含:
  - 推荐系统
  - 预算区间
  - 适用规模
```

#### 区块 3: 方案对比表
| 场景 | 推荐系统 | 预算区间 | 适用规模 |
|------|----------|----------|----------|
| 电商 | Shuttle + ACR | $800K-$2M | 中型 |
| 制造 | Stacker Crane | $1M-$5M | 大型 |
| 冷链 | Stacker Crane | $1.5M-$4M | 中大型 |
| 备件 | Shuttle | $500K-$1.5M | 中小型 |

#### 区块 4: CTA
```
标题: Get your customized solution
按钮: [Contact Us]
```

---

### 步骤 6: 创建案例研究页 (case-studies.html)

**目标**: 建立信任感

**页面结构 (4个区块)**:

#### 区块 1: 页面标题
```
标题: Real ASRS Projects
```

#### 区块 2: 案例列表
```
每个案例显示:
  - 项目规模
  - 预算
  - 系统类型
  - 效率提升
```

#### 区块 3: 案例详情结构
```
每个案例包含5个页面:
  - Overview (概览)
  - Layout (布局图)
  - System (系统配置)
  - Cost (成本分析)
  - Result (项目成果)

结构: 上方图片/视频，下方文字说明
```

#### 区块 4: CTA
```
标题: Plan your project with us
按钮: [Get Free Consultation]
```

---

### 步骤 7: 更新样式文件 (style.css)

**新增/修改内容**:

```css
/* 新增颜色变量 */
:root {
    --primary-color: #0066cc;
    --secondary-color: #cc0000;
    --accent-color: #00a651; /* ASRS绿色主题 */
    --text-dark: #333;
    --text-light: #666;
    --bg-light: #f8f8f8;
}

/* 项目规模卡片 */
.project-scale {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 30px;
}

.scale-card {
    background: linear-gradient(135deg, #fff 0%, #f5f5f5 100%);
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    padding: 40px 30px;
    text-align: center;
    transition: all 0.3s;
}

.scale-card:hover {
    border-color: var(--primary-color);
    transform: translateY(-5px);
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}

.scale-card .price {
    font-size: 32px;
    font-weight: bold;
    color: var(--primary-color);
    margin: 20px 0;
}

/* 成本计算器表单 */
.cost-form {
    background: #fff;
    border-radius: 12px;
    padding: 40px;
    box-shadow: 0 5px 20px rgba(0,0,0,0.08);
}

.form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
}

/* 系统类型展示 */
.system-types {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
}

.system-card {
    text-align: center;
    padding: 30px 20px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    transition: all 0.3s;
}

.system-card img {
    width: 80px;
    height: 80px;
    margin-bottom: 15px;
}

/* FAQ 样式 */
.faq-list {
    list-style: none;
    padding: 0;
}

.faq-list li {
    padding: 15px 0;
    border-bottom: 1px solid #e0e0e0;
    font-size: 18px;
    color: var(--text-dark);
}

.faq-list li:before {
    content: "❓ ";
    margin-right: 10px;
}

/* 案例卡片 */
.case-card {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-bottom: 40px;
    padding: 30px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 5px 20px rgba(0,0,0,0.08);
}

.case-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    text-align: center;
}

.stat-item .number {
    font-size: 28px;
    font-weight: bold;
    color: var(--primary-color);
}
```

---

### 步骤 8: 更新脚本功能 (script.js)

**新增功能**:

```javascript
// ASRS 成本计算器
function calculateASRSCost() {
    const size = document.getElementById('warehouseSize').value;
    const locations = document.getElementById('storageLocations').value;
    const sku = document.getElementById('skuCount').value;
    const frequency = document.getElementById('frequency').value;
    
    // 计算逻辑
    let baseCost = 50000;
    baseCost += locations * 150; // 每个储位成本
    baseCost += sku * 10; // SKU管理成本
    
    if (frequency > 100) baseCost *= 1.3; // 高频处理
    
    return baseCost;
}

// 表单验证和提交
function initCostEstimateForm() {
    const form = document.getElementById('costEstimateForm');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            company: form.company.value,
            location: form.location.value,
            contact: form.contact.value,
            phone: form.phone.value,
            warehouseSize: form.warehouseSize.value,
            storageLocations: form.storageLocations.value,
            unitWeight: form.unitWeight.value,
            sku: form.sku.value,
            frequency: form.frequency.value,
            timeline: form.timeline.value
        };
        
        // 发送到后端或邮件
        await submitInquiry(formData);
    });
}

// 案例筛选
function filterCases(type) {
    const cases = document.querySelectorAll('.case-card');
    cases.forEach(caseItem => {
        if (type === 'all' || caseItem.dataset.type === type) {
            caseItem.style.display = 'grid';
        } else {
            caseItem.style.display = 'none';
        }
    });
}
```

---

### 步骤 9: 优化移动端响应式

**断点设置**:
```css
/* 平板 */
@media (max-width: 1024px) {
    .project-scale,
    .system-types {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .case-card {
        grid-template-columns: 1fr;
    }
}

/* 手机 */
@media (max-width: 768px) {
    .project-scale,
    .system-types,
    .case-stats {
        grid-template-columns: 1fr;
    }
    
    .form-grid {
        grid-template-columns: 1fr;
    }
    
    .hero h1 {
        font-size: 28px;
    }
}
```

---

### 步骤 10: SEO 优化

**每个页面添加 Meta 标签**:

```html
<!-- index.html -->
<title>ASRS Warehouse Cost & Design | 13machine</title>
<meta name="description" content="Get ASRS warehouse cost estimates and system design. We help you design, estimate, and deliver automated storage solutions.">
<meta name="keywords" content="ASRS, automated storage, warehouse cost, stacker crane, shuttle system">

<!-- asrs-cost.html -->
<title>ASRS Warehouse Cost Breakdown 2026 | 13machine</title>
<meta name="description" content="ASRS warehouse cost ranges from $50K to $5M+. Get a detailed cost breakdown and custom estimate for your project.">

<!-- asrs-design.html -->
<title>ASRS Warehouse Design Guide | 13machine</title>
<meta name="description" content="Learn how to design an ASRS warehouse. Compare stacker crane, shuttle, ACR, and AMR systems.">

<!-- solutions.html -->
<title>ASRS Solutions by Industry | 13machine</title>
<meta name="description" content="ASRS solutions for e-commerce, manufacturing, cold storage, and spare parts warehouses.">

<!-- case-studies.html -->
<title>Real ASRS Project Cases | 13machine</title>
<meta name="description" content="Explore real ASRS projects. See project layouts, costs, and results.">
```

---

## 三、文件清单

### 需要创建的新文件:
1. `asrs-cost.html` - ASRS成本页
2. `asrs-design.html` - ASRS设计页
3. `case-studies.html` - 案例研究页
4. `case-detail.html` - 案例详情页模板

### 需要修改的现有文件:
1. `index.html` - 完全重构首页
2. `solutions.html` - 内容重构
3. `style.css` - 添加新样式
4. `script.js` - 添加新功能
5. `contact.html` - 更新导航

### 可以删除/归档的文件:
1. `services.html` - 功能合并到Solutions
2. `about.html` - 内容合并到首页和Case Studies
3. `insights.html` - 功能合并到Case Studies
4. `blog-detail.html` - 如不需要可删除
5. `admin.html` - 保留后台但更新导航
6. `login.html` - 保留但更新导航

---

## 四、实施优先级

### 第1阶段 (核心页面)
- [ ] 步骤1: 更新导航结构
- [ ] 步骤2: 重构首页
- [ ] 步骤7: 基础样式更新

### 第2阶段 (转化页面)
- [ ] 步骤3: ASRS成本页 (重点：询盘表单)
- [ ] 步骤4: ASRS设计页

### 第3阶段 (信任建立)
- [ ] 步骤5: 解决方案页
- [ ] 步骤6: 案例研究页

### 第4阶段 (优化)
- [ ] 步骤8: 脚本功能增强
- [ ] 步骤9: 移动端优化
- [ ] 步骤10: SEO优化

---

## 五、技术注意事项

### 5.1 保留现有功能:
- 后台管理系统 (admin.html)
- 博客/内容管理功能
- Cloudflare KV 同步
- 多语言切换框架

### 5.2 新增功能需求:
- 成本计算器表单
- 案例筛选功能
- 询盘表单提交
- 图片懒加载

### 5.3 图片资源需求:
- ASRS系统类型图片 (Stacker Crane, Shuttle, ACR, AMR)
- 案例项目照片
- 应用场景图片
- 品牌Banner图

---

## 六、部署检查清单

- [ ] 所有页面导航链接正确
- [ ] 询盘表单可以正常提交
- [ ] 移动端显示正常
- [ ] 页面加载速度 < 3秒
- [ ] SEO meta标签完整
- [ ] 图片有alt标签
- [ ] 联系信息正确
- [ ] 后台管理功能正常

---

## 七、后续优化建议

1. **内容营销**: 定期发布ASRS行业洞察文章
2. **多语言**: 添加中文版本
3. **在线客服**: 集成WhatsApp/WeChat即时通讯
4. **案例视频**: 添加项目实拍视频
5. **ROI计算器**: 开发投资回报计算器
6. **3D展示**: 添加仓库布局3D可视化

---

**文档版本**: 1.0  
**创建日期**: 2026-04-07  
**品牌**: 13machine (1³ Machine)
