## M3.5 舞台壳重构 — 当前状态总结

---

### 一、已完成的文件创建/修改

**新建文件（16个）：**

| 文件 | 说明 |
|------|------|
| `src/components/stage/GameStage.tsx` | 固定 1920×1080 画布 + ResizeObserver 等比缩放 |
| `src/components/stage/GameStage.module.css` | viewport(黑边居中) + scaler + canvas 三层结构 |
| `src/components/stage/StageLayout.tsx` | 便捷组合组件，一个 props 配置所有插槽 |
| `src/components/stage/index.ts` | barrel export |
| `src/components/stage/slots/LeftSlot.tsx` + `.module.css` | 左侧场景插槽 |
| `src/components/stage/slots/CenterSlot.tsx` + `.module.css` | 中央卷轴插槽 |
| `src/components/stage/slots/RightSlot.tsx` + `.module.css` | 右侧物品栏插槽 |
| `src/components/stage/slots/ProgressSlot.tsx` + `.module.css` | 左下角进度条插槽 |
| `src/components/stage/slots/BeadSkillSlot.tsx` + `.module.css` | 右下角佛珠技能插槽 |
| `src/components/stage/slots/index.ts` | barrel export |

**修改的文件（4个）：**

| 文件 | 改动 |
|------|------|
| `src/components/shared/TextPanel.tsx` + `.module.css` | 新增 `embedded` prop，嵌入 CenterSlot 时跳过自身背景 |
| `src/components/shared/DialogBox.tsx` | 新增 `embedded` prop，透传到 TextPanel |
| `src/phases/opening/OpeningScene.tsx` + `.module.css` | 从旧 GameLayout 迁移到 GameStage + 插槽体系 |
| `src/App.tsx` | 未实现阶段的占位也使用 GameStage 展示 |

**未修改/废弃但保留的文件：**
- `src/components/layout/` 下的旧 M3 文件（GameLayout、LeftPanel、CenterPanel、RightPanel）— 不再被引用但未删除

---

### 二、关键技术参数（必须保留）

#### 图片实际尺寸

```
UI 皮肤：
  text-panel.png         : 1000 x 1500  (2:3)
  inventory-panel.png    : 1000 x 1500  (2:3)
  pre-inventory-panel.png: 1000 x 1500  (2:3)
  progress-bar.png       : 731 x 119
  memory-skill.png       : 1000 x 1500  (2:3)
  input-box.png          : 1500 x 1000
  debate-button.png      : 214 x 67

内容图片：
  scene.png              : 1024 x 1536  (2:3)
  opening-scene.png      : 1024 x 1536  (2:3)
  npc.png                : 1000 x 1500  (2:3)
  beads.png              : 329 x 253
  item-1~4.png           : ~250-350 x ~200-260
```

#### 核心设计决策（最新一轮修改后）

- **设计画布**: 1920 × 1080（16:9）
- **所有 2:3 面板在 1080px 高度下自然宽度 = 720px**
- **三个 720px 面板总宽 2160px > 1920px，需要 240px 重叠**
- **面板使用 `<img>` 标签而非 CSS background**，保持原始比例不拉伸
- **缩放机制**: viewport → scaler → canvas 三层结构，canvas 用 `transform: scale()` + `transform-origin: 0 0`

#### 最新一轮修改的定位值（已写入代码但用户尚未验证视觉效果）

```
LeftSlot:      x=0,    y=0, w=720, h=1080, z=1
CenterSlot:    x=600,  y=0, w=720, h=1080, z=2  (与左重叠120px)
RightSlot:     x=1200, y=0, w=720, h=1080, z=3  (与中重叠120px)
ProgressSlot:  x=20, bottom=16, w=307, h=50, z=10
BeadSkillSlot: x=1180, bottom=30, w=120, h=120, z=10

CenterSlot 内容区(羊皮纸内): top=6%, left=8%, right=8%, bottom=7%
RightSlot 内容区(货架内):    top=6%, left=30%, right=28%, bottom=8%
```

---

### 三、用户反馈的问题（尚未解决）

用户看到第一版效果后指出三个问题：

1. **面板尺寸和位置不对** — 用了 `background-size: 100% 100%` 把 2:3 的图片拉伸进了不匹配的容器，导致变形。**已在第二轮修改中改为 `<img>` + 匹配容器比例**，但用户还未验证视觉效果。

2. **文字跑到卷轴外面** — 文字层的定位参考系与卷轴背景不一致。**已在第二轮修改中将内容区百分比调整为基于 720×1080 容器**，应已修复，但未经用户确认。

3. **面板之间有间隙** — 没有按游戏 UI 方式让面板重叠。**已在第二轮修改中设置 120px 重叠**，但具体重叠量可能需要微调。

**用户的核心要求是：**
> 固定比例游戏画布，所有素材 position:absolute 放进同一舞台，z-index 控制层级，文本层挂在卷轴容器内部，整体等比缩放适配屏幕。不是网页三列布局。

---

### 四、参考样例图位置

```
assets/reference/sample-opening.png    — 开场演出
assets/reference/sample-explore-root.png — 探索主界面
assets/reference/sample-item-investigation.png — 物品调查
assets/reference/sample-get-beads.png  — 获得佛珠
assets/reference/sample-memory.png     — 残念记忆
assets/reference/sample-debate.png     — 辩论阶段
assets/reference/sample-ending.png     — 幕终
```

---

### 五、下一步需要做的

1. **启动 `npm run dev` 验证视觉效果** — 确认面板重叠、文字定位是否正确
2. **微调定位参数** — 对比 `sample-opening.png` 参考图，调整 `left`、内容区 `top/left/right/bottom` 百分比
3. **确认 TypeScript 编译通过** — 最后一轮修改已通过 `tsc --noEmit`，但 Vite build 因上下文中断未验证
4. 完成后标记 plan 中 M3.5 为 ✅