import { STORY_SKELETON, GENERATION_CONSTRAINTS } from './story-skeleton.js';
import { system, user, type PromptTemplate } from './types.js';
import { defineSchema, arraySchema } from '../llm/index.js';

const zoneSchema = defineSchema({
  zoneId: { type: 'string', description: 'Unique zone ID, e.g. zone_window' },
  name: { type: 'string', description: '区域名称，必须体现主角的探索行动动词，如"走到窗边看看"、"环视屋子中央"、"翻查墙角杂物"，5-10个字' },
  summary: { type: 'string', description: '区域简述，100字以内描述环境' },
});

const sceneSchema = defineSchema({
  sceneId: { type: 'string', description: 'Scene ID, e.g. scene_herb_house' },
  title: { type: 'string', description: '场景标题，如"白家村·药铺"' },
  description: { type: 'string', description: '场景整体描述，200字以内，以主角视角描写醒来后看到的情景' },
  imageAlt: { type: 'string', description: '场景设定摘要，用于后续图片生成。格式："住所：___；居住者：___；居住方式：___；生计痕迹：___；空间重心：___；整体氛围：一句话概括"' },
});

// ---- sceneSeed 映射表 ----

interface RangeMapping {
  ranges: Array<{ from: string; to: string; label: string }>;
}

function matchRange(ch: string, mapping: RangeMapping): string {
  for (const r of mapping.ranges) {
    if (ch >= r.from && ch <= r.to) return r.label;
  }
  return mapping.ranges[mapping.ranges.length - 1]!.label;
}

const HOUSE_TYPE: RangeMapping = {
  ranges: [
    { from: 'A', to: 'E', label: '标准民居（普通村民家，以居住为主要功能）' },
    { from: 'F', to: 'J', label: '兼作营生空间的住处（前铺后居、作坊兼住、摊位旁的隔间）' },
    { from: 'K', to: 'P', label: '临时改造或公共空间被人住用（仓房改住、柴棚扩建、祠堂角落、大户附属房、磨坊偏室）' },
    { from: 'Q', to: 'U', label: '废弃建筑再利用（无主老屋、塌了一半还住着、荒废已久却有人气）' },
    { from: 'V', to: 'Z', label: '宗教/守望/过路性质兼住（破庙、山神小庙、路边土地祠、山口守屋）' },
  ],
};

const RESIDENT: RangeMapping = {
  ranges: [
    { from: 'A', to: 'D', label: '山野谋生者（猎户、采药人、烧炭工、看山人）' },
    { from: 'E', to: 'H', label: '水边谋生者（渔者、摆渡人、撑船工、水磨坊主）' },
    { from: 'I', to: 'L', label: '行走流动者（货郎、脚夫、走街小贩、行脚郎中）' },
    { from: 'M', to: 'P', label: '村中职能人物（村长、族老、守庙人、更夫、赤脚大夫）' },
    { from: 'Q', to: 'T', label: '边缘生存者（失业闲汉、寄食亲族、病弱独居者）' },
    { from: 'U', to: 'W', label: '残缺家庭（寡居老人、孤儿寡母、只剩一人的残破家户）' },
    { from: 'X', to: 'Z', label: '躲藏/暂避/身份模糊者（暂避风头、逃难借住、来历不明的人）' },
  ],
};

const LIVING_STYLE: RangeMapping = {
  ranges: [
    { from: '0', to: '2', label: '正常长期居住（稳定踏实，有积年生活感）' },
    { from: '3', to: '5', label: '单人独住（生活痕迹单一，空间利用偏向一角）' },
    { from: '6', to: '7', label: '家庭居住但已残缺（曾经有更多人，现在只剩部分痕迹）' },
    { from: '8', to: '9', label: '不是家，暂住、借住或看守职能兼住（此处另有用途，顺便住在这里）' },
  ],
};

const LIVELIHOOD: RangeMapping = {
  ranges: [
    { from: '0', to: '1', label: '劳作型（工具、材料、半成品，有汗水气息）' },
    { from: '2', to: '3', label: '交易型（度量器具、钱袋痕迹、进出货的迹象）' },
    { from: '4', to: '5', label: '修补凑合型（到处是将就的解决方案）' },
    { from: '6', to: '7', label: '清贫寥落型（东西极少，每件物品都显得珍贵）' },
    { from: '8', to: '8', label: '囤积杂乱型（东西很多但没有秩序）' },
    { from: '9', to: '9', label: '看似闲散、实则另有用途型（某些物品透露着另一种生计）' },
  ],
};

const SPACE_FOCUS: RangeMapping = {
  ranges: [
    { from: 'A', to: 'D', label: '灶台（锅碗瓢盆、柴灰、调料罐、剩食残渣、灶神像、烟熏痕）' },
    { from: 'E', to: 'H', label: '卧榻（被褥枕席、床下暗格、枕边小物、帐帘、床头搁板）' },
    { from: 'I', to: 'K', label: '供桌/香案（牌位、香烛残蜡、供品、佛像、签筒、黄纸）' },
    { from: 'L', to: 'N', label: '储柜/箱笼（衣箱、粮柜、杂物抽屉、锁具、布包、积年存物）' },
    { from: 'O', to: 'Q', label: '劳作台（工具、材料、半成品、磨刀石、线轴、碎料）' },
    { from: 'R', to: 'T', label: '腌缸/坛瓮角（腌菜缸、酒瓮、粮罐、盐坛、酱缸、盖布）' },
    { from: 'U', to: 'W', label: '水缸/洗涤角（水缸、洗盆、搓板、湿布、皂角、残水渍）' },
    { from: 'X', to: 'Z', label: '晾架/悬梁下（悬挂干货、风干腊肉、晾晒草药、挂串、绳索、梁上挂物）' },
  ],
};

export interface SceneSeedResult {
  seed: string;
  houseType: string;
  resident: string;
  livingStyle: string;
  livelihood: string;
  spaceFocus: string;
}

export function generateSceneSeed(): SceneSeedResult {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const D = '0123456789';
  const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)]!;
  const seed = `${pick(L)}${pick(L)}${pick(D)}${pick(D)}${pick(L)}`;

  const [c1, c2, c3, c4, c5] = seed.split('') as [string, string, string, string, string];
  const result: SceneSeedResult = {
    seed,
    houseType: matchRange(c1, HOUSE_TYPE),
    resident: matchRange(c2, RESIDENT),
    livingStyle: matchRange(c3, LIVING_STYLE),
    livelihood: matchRange(c4, LIVELIHOOD),
    spaceFocus: matchRange(c5, SPACE_FOCUS),
  };

  console.log(`[scene-layout] sceneSeed: ${seed}`);
  console.log(`  住所框架: ${result.houseType}`);
  console.log(`  居住者: ${result.resident}`);
  console.log(`  居住方式: ${result.livingStyle}`);
  console.log(`  生计痕迹: ${result.livelihood}`);
  console.log(`  空间主导区: ${result.spaceFocus}`);

  return result;
}

export const sceneLayoutPrompt: PromptTemplate<void> = {
  name: 'scene-layout',
  outputSchema: {
    name: 'scene_layout',
    description: 'Scene layout with zones (no items)',
    schema: defineSchema({
      scene: sceneSchema,
      zones: arraySchema(zoneSchema, { minItems: 2, maxItems: 4 }),
    }),
  },
  buildMessages: () => {
    const s = generateSceneSeed();
    return [
      system(`${STORY_SKELETON}\n\n${GENERATION_CONSTRAINTS}\n\n你是一个游戏内容生成引擎。请严格按照JSON Schema输出。`),
      user(`请为"白家村·第一世第一幕：空屋醒来"生成场景布局（住所+区域，不含物品）。

## 本次场景设定（已确定，必须严格遵循，不可更改）

以下 5 个维度已由系统随机决定（种子: ${s.seed}），你必须完全按照这些设定来构建场景，不得偏离或替换为其他类型。

- **住所框架**: ${s.houseType}
- **居住者身份**: ${s.resident}
- **居住方式**: ${s.livingStyle}
- **生计痕迹**: ${s.livelihood}
- **空间主导区**: ${s.spaceFocus}

请在上述大类范围内，联想出一个具体、细分、少见但合理的形象。例如"山野谋生者"不要总是猎户，也可以是烧炭工或看山人。最终的具体形象必须写入 scene.imageAlt 字段。

## 要求

### 场景
- sceneId格式: scene_xxx
- 主角（游方郎中）被这户村民请来诊病，诊疗中出事昏迷，现在在屋中醒来。这间屋子是村民的住所，反映的是**这户村民的身份和生计**，而非主角的职业。
- **极其重要：住所的类型、居住者身份、居住方式、生计痕迹、空间主导区必须与上面的设定吻合。如果设定是"标准民居"，就不能生成废弃建筑；如果设定是"山野谋生者"，就不能生成来历不明的人。**
- description:
  - 营造山村志怪悬疑氛围
  - 从主角"昏迷醒来"的状态开始描写，描写室内所见情形，最后落脚到表明"决定探索一下这间屋子"的意图
  - 叙述角度使用第二人称"你"
  - 不要提到故事真相，设定为主角什么都不记得了，由此展开后续决定探索的意图
- imageAlt: 将上述设定在大类范围内具体化后写入此字段，格式为"住所：___；居住者：___；居住方式：___；生计痕迹：___；空间重心：___；整体氛围：一句话概括"。填写的是具体化后的结果（如"住所：临河搭建的半吊脚棚屋"、"居住者：摆渡人"），而非维度名称或范围标签。

### 区域（2-4个）
- zoneId格式: zone_xxx
- 区域划分应以空间主导区为重心展开，例如主导区是"灶台"，则应有一个区域围绕灶台展开。
- 每个区域代表屋内一个方位，生成的文本应该体现**主角的行动**，例如"窗边"应该是"走到窗边看看"，"屋中央"应该是"环视屋子中央"等。
- 区域summary描写环境特征，100字以内。`),
    ];
  },
  defaultOptions: {
    temperature: 0.8,
    maxTokens: 2000,
  },
};
