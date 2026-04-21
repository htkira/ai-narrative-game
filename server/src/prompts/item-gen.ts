import { STORY_SKELETON, GENERATION_CONSTRAINTS } from './story-skeleton.js';
import { system, user, type PromptTemplate } from './types.js';
import { defineSchema, arraySchema } from '../llm/index.js';
import type { SceneSkeletonOutput } from '../workflows/exploration/types.js';

const descriptionEntry = defineSchema({
  itemId: { type: 'string', description: '物品ID，必须与骨架中的itemId一致' },
  description: { type: 'string', description: '物品详细描述，200字以内，以主角视角观察' },
});

const remnantEntry = defineSchema({
  itemId: { type: 'string', description: '物品ID，必须是beadReactive为true的物品' },
  text: { type: 'string', description: '残念文本，200字以内，主观片段化的残影描写' },
});

export const itemGenPrompt: PromptTemplate<SceneSkeletonOutput> = {
  name: 'item-details',
  outputSchema: {
    name: 'item_details',
    description: 'Item descriptions and bead remnant texts',
    schema: defineSchema({
      descriptions: arraySchema(descriptionEntry),
      beadRemnants: arraySchema(remnantEntry),
    }),
  },
  buildMessages: (skeleton: SceneSkeletonOutput) => {
    const itemList = skeleton.items
      .map((i) => {
        const el = i.evidenceLines?.length ? ` evidenceLines=[${i.evidenceLines.join(',')}]` : '';
        return `- ${i.itemId}(${i.name}) [${i.category}] zone=${i.zoneId} beadReactive=${i.beadReactive}${el}`;
      })
      .join('\n');

    const eLineBeadItems = skeleton.items.filter(
      (i) => i.beadReactive && i.evidenceLines?.includes('E'),
    );
    const eLineNote = eLineBeadItems.length > 0
      ? `以下物品承载了E线且beadReactive=true，它们的残念**必须**展现白姑的非攻击性行为特征：${eLineBeadItems.map((i) => `${i.itemId}(${i.name})`).join('、')}`
      : '（注意：未发现承载E线的beadReactive物品，请确保至少1条残念展现外来者非攻击性特征）';

    return [
      system(`${STORY_SKELETON}\n\n${GENERATION_CONSTRAINTS}\n\n你是一个游戏内容生成引擎。请严格按照JSON Schema输出。`),
      user(`基于以下场景骨架，为每个物品生成详细描述和残念文本。

## 场景信息
- 场景: ${skeleton.scene.title}
- 场景描述: ${skeleton.scene.description}

## 区域
${skeleton.zones.map((z) => `- ${z.zoneId}(${z.name}): ${z.summary}`).join('\n')}

## 物品列表
${itemList}

## 要求

以下所有生成的物品描述和残念文本都必须具有文学性，体现探索推理文字冒险游戏文案的风格。

### 物品描述 (descriptions)
- 为**每个物品**生成description，不得遗漏
- 以主角的视角描写，使用第二人称"你"，如"你发现..."，"你看到..."，"你闻到..."
- true_clue物品: 描述中必须包含**具体可观察的事实证据**（如特定药材成分、伤痕的形状与成因、异常物质的特征、缺失物品的痕迹等），后续线索生成步骤需要从描述中提取这些事实。如果描述太模糊（只说"有些奇怪"），就无法生成有用的线索。
- false_clue物品: 描述要看起来可疑，能引导错误推理。**绝不能在描述中主动说出"与今日之事无关""只是寻常现象""无法判断关联"之类否定自身价值的话**——伪线索的目的是误导玩家，如果描述自己就说了"这跟案子没关系"，就失去了误导作用。只描述可疑的表象和主角的初步观察/推测，让玩家自行判断
- atmosphere物品: 建立空间感和氛围
- special(残缺念珠): 描写其神秘质感和朦胧的佛教/轮回色彩，从神秘感自然顺承到主角不由自主收下这串珠子，150字以内。
- 每段物品描述200字以内，层次感: 表象→专业判断→疑点暗示（除了special物品）
- 郎中视角特征: 偏向病理、药理、身体损伤的专业观察

**语气与措辞规范（极重要）**：
描述全程保持主角内心体验的自然语气，像一个人在现场边看边想，不是旁白在做客观分析。
- **禁止使用**"暗示""强烈暗示""说明""表明""意味着""证明了"等旁白分析式用语
- **应当使用**主角的主观反应和推测语气，如"你心里一沉""你觉得不太对劲""你琢磨着……""凭你行医的经验，这分明是……""你不由得想，难道……""看这架势，怕是……"
- 好的写法："这药方本身对症，但那股异常腥气和抓痕让你心头一紧——服药者的状态，怕是远比寻常癫狂更剧烈、更失控。"
- 坏的写法："这药方本身对症，但那股异常腥气和抓痕，暗示服药者的状态远比寻常癫狂更剧烈、更失控。"
- 事实证据本身要写得具体（药材成分、痕迹形态等），但对事实的判断和联想要用主角的口吻和情绪来传递，而非客观陈述

**物品描述覆盖要求（极其重要）**：
每个物品已标注了 evidenceLines，表示该物品承载的推理线。请严格按照标注来写描述，确保描述中包含对应推理线所需的具体可观察事实。

各推理线对应的描述要点：
- A（死者死前状态异常/发病）：药方成分（如治疗癫狂的药材）、患者发病体征痕迹等具体证据
- B（外来者与发病患者之间发生过激烈打斗）：两方扭打的物理痕迹（碰撞、拖拽、血迹等），证据应能让玩家推断出冲突发生在闯入者与屋内患者之间，而非其他人
- C（有外来者来过现场）：不属于屋主的异常材质、痕迹或物质（如异常纤维、非人常见的触碰痕迹等）
- D（有骨骼/物品被带走）：搬运痕迹、骨粉/碎骨残留、明显被掏空或缺失的迹象
- E（外来者行为不像食人妖怪）：主要由残念文本承载，描述中可轻微铺垫

### 残念文本 (beadRemnants)
- 只为beadReactive=true的物品生成
- 描写念珠触碰物品时看到的"最后一次强烈执念的一念残影"
- 残影特点: 主观、极短片段、可能受情绪扭曲、只够形成印象
- **每条残念的内容方向必须与该物品的 evidenceLines 标注一致**：
  - evidenceLines含A的物品：残念应展现患者发病时的痛苦、挣扎、失控
  - evidenceLines含B的物品：残念应展现冲突中的某个激烈瞬间，体现双方搏斗
  - evidenceLines含E的物品：残念**必须**展现外来者（白姑）的非攻击性行为特征——如小心翼翼地收集骨骼、犹豫的手势、悲悯的目光、轻轻叹息、替死者整理遗物等。这是玩家了解"白姑不像纯粹妖怪"的唯一途径，极其重要
  - 其他推理线的物品：根据对应推理线内容自行发挥
- ${eLineNote}
- 200字以内，带有强烈情绪色彩
- **格式禁令（极其重要）**：文本必须直接以残影画面开头，禁止任何前缀性旁白或标注。具体禁止：括号内的感官/情绪提示（如"（冰冷、迅捷的触碰）"）、冒号引导语（如"残影出现："、"残念："）、引号包裹整段文本。正确示例："一只苍白得近乎透明的手……"；错误示例："（混乱、痛苦的残影）一只颤抖的手……"`),
    ];
  },
  defaultOptions: {
    temperature: 0.7,
    maxTokens: 6000,
  },
};
