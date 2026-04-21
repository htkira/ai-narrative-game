import { STORY_SKELETON, GENERATION_CONSTRAINTS } from './story-skeleton.js';
import { system, user, type PromptTemplate } from './types.js';
import { defineSchema, arraySchema } from '../llm/index.js';
import type { ExplorationResult } from '../workflows/exploration/types.js';

// ---- npcSeed 映射表 ----

interface RangeMapping {
  ranges: Array<{ from: string; to: string; label: string }>;
}

function matchRange(ch: string, mapping: RangeMapping): string {
  for (const r of mapping.ranges) {
    if (ch >= r.from && ch <= r.to) return r.label;
  }
  return mapping.ranges[mapping.ranges.length - 1]!.label;
}

const NPC_ROLE: RangeMapping = {
  ranges: [
    { from: 'A', to: 'E', label: '宗族长辈（族老、长房家主、辈分最高的白发老者、管祠堂的人）' },
    { from: 'F', to: 'J', label: '村务管事（里正/村长、保甲长、管公田的人、分水的头人）' },
    { from: 'K', to: 'O', label: '技艺领头（猎户头子、老药农、屠户、铁匠头、烧炭把头）' },
    { from: 'P', to: 'T', label: '信仰/玄学人物（庙祝、看香婆、风水先生、收殓人、神婆）' },
    { from: 'U', to: 'Z', label: '经济/商事人物（粮栈掌柜、山货收购商、牙行经纪、典当铺主）' },
  ],
};

const NPC_TEMPERAMENT: RangeMapping = {
  ranges: [
    { from: 'A', to: 'F', label: '暴躁冲动（一点就着、说话像吵架、拍桌子瞪眼、声音压过一切）' },
    { from: 'G', to: 'L', label: '阴沉多疑（慢吞吞的、每句话像在审问、眯着眼打量人、冷笑）' },
    { from: 'M', to: 'R', label: '倚老卖老（"我活了这么多年……"、用资历压人、语重心长但不讲理）' },
    { from: 'S', to: 'V', label: '精明世故（表面公允实则话里有话、擅长引导舆论、不直接骂而是暗中架火）' },
    { from: 'W', to: 'Z', label: '胆小逞强（越害怕嗓门越大、虚张声势、一被反驳就慌但马上补锅）' },
  ],
};

const NPC_PREJUDICE: RangeMapping = {
  ranges: [
    { from: '0', to: '3', label: '亲历创伤（自己或至亲曾遭遇白骨症/疑似白姑相关的事件，恐惧来自切肤之痛）' },
    { from: '4', to: '6', label: '传说信徒（深信祖辈口传的白姑食人故事，对自己的"见识"深信不疑）' },
    { from: '7', to: '9', label: '利益/地位驱动（需要找替罪羊稳定村民情绪、维护自己的权威地位）' },
  ],
};

const NPC_SPEECH: RangeMapping = {
  ranges: [
    { from: '0', to: '2', label: '粗犷直白（短句、粗话、大嗓门，"我跟你说！""你别跟我扯！"）' },
    { from: '3', to: '4', label: '绵里藏针（表面客气，"郎中你且听我一言"，但每句话都在施压）' },
    { from: '5', to: '6', label: '煽动裹挟（频繁搬出"大伙儿都知道""全村人都看见了"来壮声势）' },
    { from: '7', to: '8', label: '故弄玄虚（半文半白、爱用"老话说得好……"、装出见多识广的样子）' },
    { from: '9', to: '9', label: '碎碎念型（啰嗦、反复念叨，"我早就说过……""你看看你看看……"）' },
  ],
};

export interface NpcSeedResult {
  seed: string;
  role: string;
  temperament: string;
  prejudice: string;
  speech: string;
}

export function generateNpcSeed(): NpcSeedResult {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const D = '0123456789';
  const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)]!;
  const seed = `${pick(L)}${pick(L)}${pick(D)}${pick(D)}`;

  const [c1, c2, c3, c4] = seed.split('') as [string, string, string, string];
  const result: NpcSeedResult = {
    seed,
    role: matchRange(c1, NPC_ROLE),
    temperament: matchRange(c2, NPC_TEMPERAMENT),
    prejudice: matchRange(c3, NPC_PREJUDICE),
    speech: matchRange(c4, NPC_SPEECH),
  };

  console.log(`[debate-init] npcSeed: ${seed}`);
  console.log(`  身份类型: ${result.role}`);
  console.log(`  性格基调: ${result.temperament}`);
  console.log(`  偏见根基: ${result.prejudice}`);
  console.log(`  说话腔调: ${result.speech}`);

  return result;
}

// ---- Schema ----

const npcSchema = defineSchema({
  npcId: { type: 'string', description: 'NPC ID，格式: npc_xxx，如 npc_elder、npc_hunter' },
  name: { type: 'string', description: 'NPC姓名，如"赵老爷子"、"刘猎户"、"孙药婆"' },
  role: { type: 'string', description: '角色身份，如"白家村族老"、"村中猎户头子"、"庙祝"' },
  tone: {
    type: 'string',
    description: '说话风格关键词，与角色身份匹配，如"惊慌、固执、先入为主"',
  },
  appearance: {
    type: 'string',
    description: 'NPC外貌描述，用于生成立绘，50-100字。描述年龄、体型、服饰、面部特征等，需与身份匹配。如"六旬老者，瘦削身形，灰白长须，穿土黄粗布长衫，头裹深色巾帻，面容严厉，眉间刻满忧纹"',
  },
});

const claimSchema = defineSchema({
  claimId: {
    type: 'string',
    description: '观点ID，格式: claim_1, claim_2, claim_3 ...',
  },
  opposedTruth: {
    type: 'string',
    enum: ['A', 'B', 'D'],
    description:
      '此观点对立的真相线：A=否认死者发病（主张死者好好的被害死）, B=否认双向对抗（主张白姑单方面行凶）, D=否认收集行为（主张白姑食人吞骨）',
  },
  text: {
    type: 'string',
    description: 'NPC的一条指控/论点，30-60字。必须包含一个可被物证否定的错误前提',
  },
  wrongPremise: {
    type: 'string',
    description:
      '此观点隐含的错误前提，10-25字。例如"死者生前身体无恙"、"打斗是单方面行凶"',
  },
  basis: {
    type: 'string',
    description: '论据来源，用NPC第一人称口吻陈述他认为支持此观点的依据，如"村里人都看见了那夜的动静"、"我亲眼瞧见屋里翻得乱七八糟"。20-40字',
  },
  basedOnFalseClue: {
    type: 'boolean',
    description: '此观点论据是否来自伪线索(false_clue类物品)',
  },
  refutableByClueIds: arraySchema(
    { type: 'string', description: '可驳倒此观点的线索ID——该线索的内容必须能否定此观点的wrongPremise' },
    { minItems: 1 },
  ),
});

const debateInitOutputSchema = defineSchema({
  npc: npcSchema,
  claims: arraySchema(claimSchema, { minItems: 3, maxItems: 3 }),
  openingSpeech: {
    type: 'string',
    description: 'NPC开场白，80-150字，设定对抗基调',
  },
});

// ---- Input type ----

export type DebateInitPromptInput = ExplorationResult;

// ---- Prompt template ----

export const debateInitPrompt: PromptTemplate<DebateInitPromptInput> = {
  name: 'debate-init',
  outputSchema: {
    name: 'debate_init',
    description: 'NPC claims and opening speech for debate phase',
    schema: debateInitOutputSchema,
  },
  buildMessages: (input: DebateInitPromptInput) => {
    const npcSeed = generateNpcSeed();

    const trueClueItems = input.items.filter(
      (i) => i.category === 'true_clue',
    );
    const falseClueItems = input.items.filter(
      (i) => i.category === 'false_clue',
    );

    const evidenceClues = input.clueDefinitions.filter(
      (c) => c.usableAsEvidence,
    );

    const itemsSummary = input.items
      .filter((i) => i.category !== 'special' && i.category !== 'atmosphere')
      .map((i) => {
        const desc = input.itemDescriptions[i.itemId] ?? '';
        return `- ${i.itemId}(${i.name}) [${i.category}]\n  描述片段: ${desc.slice(0, 100)}...`;
      })
      .join('\n');

    const cluesSummary = evidenceClues
      .map(
        (c) =>
          `- ${c.clueId}: ${c.title} [${c.type}] 来源=${c.sourceItemId}\n  摘要: ${c.summary.slice(0, 80)}...`,
      )
      .join('\n');

    const falseClueContext = falseClueItems
      .map((i) => {
        const desc = input.itemDescriptions[i.itemId] ?? '';
        return `- ${i.itemId}(${i.name}): ${desc.slice(0, 100)}...`;
      })
      .join('\n');

    return [
      system(`${STORY_SKELETON}

${GENERATION_CONSTRAINTS}

你是一个游戏内容生成引擎。你正在为辩论阶段生成辩论NPC的身份、观点和开场白。

## NPC身份设定（已确定，必须严格遵循，不可更改）

以下 4 个维度已由系统随机决定（种子: ${npcSeed.seed}），你必须完全按照这些设定来构建NPC角色，不得偏离或替换为其他类型。

- **身份类型**: ${npcSeed.role}
- **性格基调**: ${npcSeed.temperament}
- **偏见根基**: ${npcSeed.prejudice}
- **说话腔调**: ${npcSeed.speech}

请在上述大类范围内，联想出一个具体、细分、少见但合理的人物形象。例如"宗族长辈"不要总是族老，也可以是管祠堂的老人或长房家主；"技艺领头"不要总是猎户，也可以是屠户、烧炭把头。

NPC的核心角色定位（不论身份如何，必须满足）：
- 代表村民的集体偏见，坚信白姑是害人妖邪
- 先入为主，不擅严密推理，靠直觉和情绪判断
- 会嘴硬、补锅、被驳倒后不情愿地后撤
- 性格基调和说话腔调必须与上方设定一致

## NPC外貌描述（appearance）
请为NPC生成一段外貌描述（50-100字），用于后续立绘图片生成。要求：
- 描述年龄、体型、服饰、面部特征等核心视觉元素
- 与所选角色身份和性格基调吻合
- 服饰细节需符合中国古代山村特征（粗布衣、头巾、草鞋等）
- 面部表情应体现其性格基调中的特征

## 核心机制：反驳关系的正确构建

辩论的核心逻辑是：NPC的观点建立在**错误前提**上，玩家出示的物证揭示**真实情况**，否定了错误前提，从而完成反驳。

### 五条真相与NPC的错误叙事

物证指向的真相（玩家通过探索能推断的结论）：
- **A（死者发病）**: 死者死前状态异常，疑似先发病——不是被白姑杀死的
- **B（双向对抗）**: 屋内的打斗是外来者与发病患者之间的双向搏斗——不是单方面行凶
- **D（收集非食人）**: 白姑带走了骨与部分物品，方式是小心收集/搬运——不是"食人吞骨"
（C线"白姑来过现场"是双方共识；E线"白姑非恶意"的证据来自念珠残念，属于超自然感知，不适合用作辩论论据。因此C、E不参与辩论。）

NPC的偏见叙事（错误推断，应被反驳）：
- **反A**: "死者好好的/一向硬朗，肯定是被白姑害死的"
- **反B**: "屋里这些打斗痕迹，一看就是那妖怪闯入把人按住打杀的"
- **反D**: "骨头都不见了，白姑把人吃得干干净净"

### 有效反驳 vs 无效反驳（极重要！）

**有效反驳**（NPC的错误前提被物证否定）：
- NPC说"这人平时身体硬朗，肯定是被白姑害死的" → 物证显示"药渣成分异常、死者生前已有发病体征" → **矛盾成立**：死者并非好好的，在白姑来之前就已发病
- NPC说"屋里打斗痕迹说明白姑把人按住打杀的" → 物证显示"打斗痕迹呈双向分布，褥席上也有患者挣扎攻击的痕迹" → **矛盾成立**：不是单方面行凶，患者自己也在发疯攻击
- NPC说"骨头不见了，白姑分明是食人妖" → 物证显示"搬运痕迹整齐有序、包裹收集的残屑" → **矛盾成立**：是小心收集搬走，不是暴力食用

**无效反驳**（观点和线索说的是同一件事，不构成矛盾）：
- NPC说"窗台有痕迹，白姑在偷看" → 线索也说"窗台有外来者窥视痕迹" → 没有矛盾，两者在描述相同事实
- NPC说"有人闯入了这间屋子" → 线索也说"确实有外来者进入" → 没有矛盾
- NPC说"屋里有打斗" → 线索也说"有打斗痕迹" → 没有矛盾，只是同义复述

**关键原则**：NPC观点的核心不是描述一个现象（那样线索只能"证实"它），而是对现象做出一个**错误归因或错误推断**，而线索提供的专业证据能推翻这个归因。

## 观点生成规则

1. 生成恰好3条指控白姑的观点，层层递进：从最直觉的指控到最"有力"的论据
2. **每条观点必须对立一条真相线**：用opposedTruth标注A/B/D，3条观点分别对立3条真相线（不重复，全覆盖）
3. **每条观点必须包含一个可被否定的错误前提**：用wrongPremise字段写明。NPC基于恐惧和偏见做出的错误推断，而非对物证的简单复述
4. 论据（basis）必须用NPC的第一人称口吻写——是NPC自己的话，如"我知道屋主平日是什么体格"、"你看这屋里桌椅全砸烂了"。绝不能写成旁观者的客观分析（如"对屋内打斗痕迹的直观、表面观察"这种上帝视角是错误的）。内容应是村中传闻、亲眼所见、道听途说、个人臆断等，NPC视角内合理、但经不起仔细观察和专业分析的"证据"
5. refutableByClueIds引用下方线索列表中的clueId，该线索的内容必须能**直接否定**此观点的wrongPremise
6. refutableByClueIds中的每个clueId都必须来自下方【可用线索列表】
7. 至少1条观点的论据来自伪线索(false_clue类物品)，将该条的basedOnFalseClue设为true

## 开场白要求
- 80-150字，设定对抗基调
- NPC急急忙忙赶来查看情况，言语中表明"一定是那个女妖怪干的"的意思，发现主角在场于是质问主角
- 带有指控和逼迫感，说话风格与所选NPC身份一致
- 为后续逐条指控做铺垫`),
      user(`基于以下探索阶段的数据，生成NPC辩论内容。

## 场景
${input.scene.title}: ${input.scene.description.slice(0, 100)}...

## 关键物品（真线索物和伪线索物）
${itemsSummary}

## 伪线索物品（false_clue）详情
${falseClueContext || '（无）'}

## 可用线索列表（refutableByClueIds必须从此列表中选取）
${cluesSummary}

## 关键数据统计
- 真线索物品: ${trueClueItems.length} 个
- 伪线索物品: ${falseClueItems.length} 个
- 可作证据的线索: ${evidenceClues.length} 条

请生成辩论NPC的人物身份设定、3条指控观点和开场白。`),
    ];
  },
  defaultOptions: {
    temperature: 0.8,
    maxTokens: 3000,
  },
};
