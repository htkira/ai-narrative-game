import { STORY_SKELETON, GENERATION_CONSTRAINTS } from './story-skeleton.js';
import { system, user, type PromptTemplate } from './types.js';
import { defineSchema, enumSchema, arraySchema } from '../llm/index.js';
import { getAllIconTags } from '../cache/iconTagRegistry.js';
import type { SceneLayoutOutput } from '../workflows/exploration/types.js';

const itemSchema = defineSchema({
  itemId: { type: 'string', description: 'Unique item ID, e.g. item_1, item_2, ..., item_bead' },
  name: { type: 'string', description: '物品名称，2-5个字' },
  category: enumSchema(['atmosphere', 'false_clue', 'true_clue', 'special']),
  zoneId: { type: 'string', description: '所属区域ID，必须是zones中定义的zoneId' },
  hasClue: { type: 'boolean', description: '是否包含可提取的线索' },
  beadReactive: { type: 'boolean', description: '残缺念珠能否感应此物（special类别本身为false）' },
  iconTag: {
    type: 'string',
    description: '物品图标标签，优先从已有标签列表中选取；若无合适标签可自创新标签（全小写英文+下划线，2-30字符，如 weaving_shuttle）。special（念珠）固定使用 bead_string。',
  },
  evidenceLines: {
    type: 'array',
    items: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'] },
    description: '该物品承载的推理线标识。atmosphere和special物品为空数组。',
  },
});

// ---- clueSeed 映射表 ----

interface RangeMapping {
  ranges: Array<{ from: string; to: string; label: string }>;
}

function matchRange(ch: string, mapping: RangeMapping): string {
  for (const r of mapping.ranges) {
    if (ch >= r.from && ch <= r.to) return r.label;
  }
  return mapping.ranges[mapping.ranges.length - 1]!.label;
}

const LINE_A_CARRIER: RangeMapping = {
  ranges: [
    { from: 'A', to: 'I', label: '治疗物（药碗、药包、残方、煎药器具）' },
    { from: 'J', to: 'R', label: '身体体征物（污布、抓痕褥席、带齿痕的木片、呕吐残留容器）' },
    { from: 'S', to: 'Z', label: '被中断的诊治动作（翻开的医书、半磨的药末、未喝完的药汁）' },
  ],
};

const LINE_B_CARRIER: RangeMapping = {
  ranges: [
    { from: 'A', to: 'F', label: '家具受力痕迹（两人扭打时撞出的撞痕、裂角、翻倒、卡进墙缝）' },
    { from: 'G', to: 'L', label: '挣扎位移痕迹（双方缠斗中拖拽褥席、歪斜板凳、散落小件）' },
    { from: 'M', to: 'S', label: '防御/反击痕迹（被抓起又丢开的工具、护身时留下的破损、抵挡的痕迹）' },
    { from: 'T', to: 'Z', label: '打击结果痕迹（冲突留下的木屑、碎陶、擦血、钝器印）' },
  ],
};

const LINE_C_CARRIER: RangeMapping = {
  ranges: [
    { from: '0', to: '2', label: '入口异常（门槛、窗台、门闩、窗纸、门边泥屑）' },
    { from: '3', to: '4', label: '外来材质（不属于屋主生活圈的纤维、灰粉、皮屑、草籽）' },
    { from: '5', to: '6', label: '借道痕迹（本不该移动的位置被踩踏、搭脚、攀附）' },
    { from: '7', to: '9', label: '停留痕迹（临时搁放、扶按、轻触后留下的异样）' },
  ],
};

const LINE_D_CARRIER: RangeMapping = {
  ranges: [
    { from: '0', to: '2', label: '搬运路径（拖痕、负重擦痕、门窗方向的连续位移）' },
    { from: '3', to: '4', label: '缺失痕迹（被掏空的箱格、空出的墙钩、缺了一样该在场的东西）' },
    { from: '5', to: '6', label: '残留碎屑（骨粉、碎片、捆绑残线、包裹残屑）' },
    { from: '7', to: '9', label: '二次整理痕迹（为了拿走某物而翻动、挪开、再勉强摆回）' },
  ],
};

const LINE_E_CARRIER: RangeMapping = {
  ranges: [
    { from: 'A', to: 'F', label: '照护动作（替患者垫高、扶正、掩盖、盖衣）' },
    { from: 'G', to: 'L', label: '迟疑动作（手伸到一半又缩回、停顿、回头、避开致命处）' },
    { from: 'M', to: 'S', label: '悲悯动作（收拾散落遗物、把伤者摆正、轻放、停留）' },
    { from: 'T', to: 'Z', label: '克制动作（明明能粗暴处理却选择绕开、小心搬动、避免惊扰）' },
  ],
};

export interface ClueSeedResult {
  seed: string;
  lineA: string;
  lineB: string;
  lineC: string;
  lineD: string;
  lineE: string;
}

export function generateClueSeed(): ClueSeedResult {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const D = '0123456789';
  const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)]!;
  const seed = `${pick(L)}${pick(L)}${pick(D)}${pick(D)}${pick(L)}`;

  const [k1, k2, k3, k4, k5] = seed.split('') as [string, string, string, string, string];
  const result: ClueSeedResult = {
    seed,
    lineA: matchRange(k1, LINE_A_CARRIER),
    lineB: matchRange(k2, LINE_B_CARRIER),
    lineC: matchRange(k3, LINE_C_CARRIER),
    lineD: matchRange(k4, LINE_D_CARRIER),
    lineE: matchRange(k5, LINE_E_CARRIER),
  };

  console.log(`[item-skeleton] clueSeed: ${seed}`);
  console.log(`  A线承载: ${result.lineA}`);
  console.log(`  B线承载: ${result.lineB}`);
  console.log(`  C线承载: ${result.lineC}`);
  console.log(`  D线承载: ${result.lineD}`);
  console.log(`  E线承载: ${result.lineE}`);

  return result;
}

export const itemSkeletonPrompt: PromptTemplate<SceneLayoutOutput> = {
  name: 'item-skeleton',
  outputSchema: {
    name: 'item_skeleton',
    description: 'Item skeleton with evidence line assignments',
    schema: defineSchema({
      items: arraySchema(itemSchema, { minItems: 10, maxItems: 14 }),
    }),
  },
  buildMessages: (layout: SceneLayoutOutput) => {
    const allTags = getAllIconTags();
    const tagList = allTags.join(', ');
    const cs = generateClueSeed();

    const zoneList = layout.zones
      .map((z) => `- ${z.zoneId}(${z.name}): ${z.summary}`)
      .join('\n');

    return [
      system(`${STORY_SKELETON}\n\n${GENERATION_CONSTRAINTS}\n\n你是一个游戏内容生成引擎。请严格按照JSON Schema输出。`),
      user(`基于以下已确定的场景布局，生成物品骨架（含推理线分配）。

## 场景信息
- 场景: ${layout.scene.title} (${layout.scene.sceneId})
- 场景描述: ${layout.scene.description}
- 场景设定: ${layout.scene.imageAlt}

## 区域
${zoneList}

## 本次线索承载方式（已确定，必须严格遵循，不可更改）

以下 5 条推理线的承载家族已由系统随机决定（种子: ${cs.seed}），你必须按照这些承载方式来规划物品，不得偏离。在给定的承载家族范围内，选择具体的、与本场景住所类型和居住者身份吻合的物品形式。

- **A线（死者发病）承载家族**: ${cs.lineA}
- **B线（外来者与发病患者之间的激烈打斗）承载家族**: ${cs.lineB}
- **C线（外来者来过现场）承载家族**: ${cs.lineC}
- **D线（有东西被带走）承载家族**: ${cs.lineD}
- **E线（外来者行为不像攻击者，必须由 beadReactive=true 的物品承载）承载家族**: ${cs.lineE}

## 线索规划要求

请根据上面已确定的承载家族，结合本场景的住所类型和居住者身份，为每条线选择具体的宿主物件。

### 规划步骤
1. 承载家族已确定，在其范围内选择与本场景吻合的具体物品
2. 为每条线选择显现方式（混合使用，不要全用"直接证据"）：
   - 直接证据：一眼能看出
   - 间接证据：需要专业观察才能发现
   - 残留证据：事件之后留下的边角
   - 负空间证据：某个本该存在的东西不见了
3. 确定每个物品的 evidenceLines 标注

### 交叉承载规则
- 每条推理线(A-E)至少被 1 个物品的 evidenceLines 覆盖
- 单个物品最多承载 2 条推理线
- **E线特殊规则**：E线的宿主物品必须同时满足 beadReactive=true，因为E线的内容（白姑的非攻击性行为特征）通过念珠残念来呈现。请确保至少1个 beadReactive=true 的物品的 evidenceLines 包含 E
- B线尽量不与其他线共享同一物品
- A/C/D 可以适度交叉
- atmosphere 和 special 物品的 evidenceLines 为空数组 []

## 物品要求

### 物品（10-14个）
- itemId格式: item_1, item_2, ... 残缺念珠用 item_bead
- 每个物品分配到一个区域（物品和它所在的区域必须符合逻辑关系）
- **分类要求**:
  - atmosphere（纯氛围物）: 至少2个，建立空间真实感
  - false_clue（伪线索物）: 至少2个，看起来可疑但实际无法反驳NPC的核心观点
  - true_clue（真线索物）: 至少5个，帮助拼出真相的关键物证
  - special（残缺念珠）: 恰好1个，itemId必须是item_bead
- **标记规则**:
  - hasClue: true_clue 和 false_clue 物品均设为true（两者都会被提取线索并出现在辩论物证栏中），atmosphere和special为false
  - beadReactive: atmosphere、false_clue、true_clue都可以设为true（可被念珠感应出残念），至少2个物品为true，special本身为false
  - special（念珠）的hasClue、beadReactive均为false
- **evidenceLines 标记**:
  - true_clue 和 false_clue 物品：标注该物品承载的推理线（如 ["A"], ["B","D"]）
  - atmosphere 物品：空数组 []
  - special 物品：空数组 []

### 物证丰富度（极重要！）
辩论阶段玩家需要从物证栏中选择物品来反驳NPC的3条错误观点。为了让选择有策略深度而非暴力穷举，需要保证物证栏中有足够多的物品（目标7-10个），其中包含：
- **关键物证**（true_clue）：每条参与辩论的推理线（A/B/D）至少有1个物品承载能直接反驳NPC错误前提的强力证据
- **补充物证**（true_clue）：同一推理线上的第2个物品，提供相关但不够决定性的观察（如D线上"有骨粉残留"只能说明骨头碎了，不能说明是被吃还是被搬；但"有序的搬运拖痕"才能证明是搬运而非食用）。这类物品在辩论中选中时会被NPC轻松驳回
- **干扰物证**（false_clue）：看似有关联的可疑物品，但其线索指向的事实无法否定NPC的任何错误前提。选中时NPC会嘲讽玩家

### 物品创意方向
物品应大部分来自屋子主人的日常生活与职业（体现场景设定中的居住者身份和生计痕迹），同时结合真实事件链的痕迹。
- 诊病相关的物品（如药碗、药方）可以少量出现（因为主角自带），但不应占物品的主体。
- 在已确定的承载家族范围内选择具体物品，优先从"痕迹类型"出发，再决定由哪件东西承载。

### 物品图标标签（iconTag）
每个物品必须指定一个 iconTag。已有标签列表：
${tagList}

选取规则：
- **优先从已有标签中选取**最能代表该物品视觉形象的标签
- 如果已有标签都不贴切，**可以自创新标签**，格式要求：全小写英文 + 下划线连接，2-30字符（如 weaving_shuttle、fish_basket、clay_jar）
- special（念珠）的 iconTag 固定为 bead_string
- 不同物品可以使用相同的 iconTag（如两个都是碗类物品）
- 新标签应简洁明确，描述物品的视觉形象`),
    ];
  },
  defaultOptions: {
    temperature: 0.8,
    maxTokens: 4000,
  },
};
