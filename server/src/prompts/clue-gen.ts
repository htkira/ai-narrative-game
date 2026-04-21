import { STORY_SKELETON, GENERATION_CONSTRAINTS } from './story-skeleton.js';
import { system, user, type PromptTemplate } from './types.js';
import { defineSchema, enumSchema, arraySchema } from '../llm/index.js';
import type { SceneSkeletonOutput, ItemDetailsOutput } from '../workflows/exploration/types.js';

const clueSchema = defineSchema({
  clueId: { type: 'string', description: '线索ID，格式: clue_xxx 或 clue_bead_xxx（念珠残念线索）' },
  title: { type: 'string', description: '线索标题，简短中文，4-8字' },
  summary: { type: 'string', description: '线索摘要，1-2句话，描述线索揭示了什么' },
  sourceItemId: { type: 'string', description: '来源物品ID，必须与骨架中的itemId一致' },
  type: enumSchema(['pathology', 'pharmacology', 'conflict_trace', 'bead_memory', 'misc']),
  usableAsEvidence: { type: 'boolean', description: '是否可作为辩论证据使用' },
});

export interface ClueGenInput {
  skeleton: SceneSkeletonOutput;
  details: ItemDetailsOutput;
}

export const clueGenPrompt: PromptTemplate<ClueGenInput> = {
  name: 'clue-mapping',
  outputSchema: {
    name: 'clue_mapping',
    description: 'Clue definitions linked to items',
    schema: defineSchema({
      clues: arraySchema(clueSchema),
    }),
  },
  buildMessages: ({ skeleton, details }: ClueGenInput) => {
    const itemSummary = skeleton.items
      .map((i) => {
        const desc = details.descriptions.find((d) => d.itemId === i.itemId);
        const el = i.evidenceLines?.length ? ` evidenceLines=[${i.evidenceLines.join(',')}]` : '';
        return `- ${i.itemId}(${i.name}) [${i.category}] hasClue=${i.hasClue} beadReactive=${i.beadReactive}${el}\n  描述: ${desc?.description?.slice(0, 80) ?? '(无)'}...`;
      })
      .join('\n');

    const remnantSummary = details.beadRemnants
      .map((r) => `- ${r.itemId}: ${r.text.slice(0, 60)}...`)
      .join('\n');

    return [
      system(`${STORY_SKELETON}\n\n${GENERATION_CONSTRAINTS}\n\n你是一个游戏内容生成引擎。请严格按照JSON Schema输出。`),
      user(`基于以下场景骨架和物品描述，生成线索定义表。

## 物品信息
${itemSummary}

## 残念信息（念珠感应到的残影）
${remnantSummary}

## 要求

### 线索生成规则
1. **直接线索**: 为每个hasClue=true的物品（true_clue类别）生成**恰好1条**线索
   - clueId格式: clue_xxx（如clue_herb, clue_struggle）
   - sourceItemId指向对应物品
   - type根据内容选择: pathology/pharmacology/conflict_trace/misc
   - usableAsEvidence=true

2. **念珠残念线索**: 为每个beadReactive=true的物品生成**恰好1条**bead_memory线索
   - clueId格式: clue_bead_xxx（如clue_bead_basket）
   - sourceItemId指向对应物品
   - type必须是bead_memory
   - usableAsEvidence=true
   - summary应概括残念揭示的信息

3. **每个物品最多2条线索**: 一个物品如果同时hasClue=true且beadReactive=true，则有2条线索（1条直接+1条残念）；否则最多1条。不要为同一个物品生成超出此规则的线索。

4. **线索类型分布**:
   - pathology(病理观察): 异常发病、体征相关
   - pharmacology(药理判断): 药渣、药方、配伍相关
   - conflict_trace(冲突痕迹): 打斗、挣扎、破坏相关
   - bead_memory(念珠残念): 通过念珠获得的主观残影
   - misc(杂项): 其他有助推理的线索

5. **线索覆盖要求（极其重要！）**:
   每个物品已标注了 evidenceLines，表示该物品承载的推理线。请严格按照标注生成对应推理线的线索。每条推理线至少有1条线索提供实质支撑。

   各推理线方向参考：
   - A（死者死前状态异常）：药方/药渣成分、患者发病体征痕迹等
   - B（外来者与发病患者之间发生过激烈打斗）：两方扭打的碰撞痕迹、挣扎拖拽痕迹、血迹等，线索应帮助玩家推断冲突发生在闯入者与屋内患者之间
   - C（有外来者来过现场，不能说"白姑"的名字）：不属于屋主的异常痕迹、材质、物质等
   - D（有骨骼/物品被带走）：搬运痕迹、碎骨残留、明显缺失的迹象等
   - E（外来者行为不像"食人妖怪"，通常由念珠残念提供）：动作带有小心、犹豫、悲悯等非攻击性特征

6. **线索内容约束**:
  - 线索是主角（一个游方郎中）基于自身职业能力对物品的观察总结。线索的核心作用是为玩家提供可在辩论中使用的实质性证据，同时保持角色代入感。
  - **专业判断优先**：主角虽然不是侦探，但他是一个行医多年的郎中，在病理、药理、外伤、体征等方面有扎实的专业判断力。线索摘要应体现这种专业性——主角能辨认药渣成分、判断伤口成因、识别异常体征等。例如："药渣中混有少量雄黄粉，这并非治病之物，反而可能加重癫狂之症"比"这药渣里好像有什么奇怪的东西？"更能帮助玩家在辩论中使用。
  - **给出实质内容但不点破全局**：线索应当给出物品层面的具体判断（如"这是什么物质""这种伤是怎么形成的""这种症状说明了什么"），但不能跳跃到故事全局真相（如直接说出谁杀了谁、白姑的真实身份和动机等）。换言之，每条线索是一块拼图——它自身的信息是明确的，但整幅画需要玩家自己拼。
  - **严禁泄露骨架真相**：不得以任何形式（包括括号注释、举例、类比等）提及玩家尚无法得知的信息，如"白姑""爪""骸骨"等概念。线索只能基于物品上可直接观察到的物理证据进行专业推断。
  - **语气与代入感**：使用郎中的第一人称内心独白式语气，有职业自信但措辞留有余地。好的模式："凭我行医的经验，这分明是……""我敢断定这种痕迹是……不过，为何会出现在这里？"。避免纯疑问句式（如"这是什么呢？"），也避免法医报告式的冰冷断言。

### 数量要求
- 直接线索: 与hasClue=true的物品数量一致
- 念珠残念线索: 与beadReactive=true的物品数量一致
- 总计应有6-10条线索`),
    ];
  },
  defaultOptions: {
    temperature: 0.7,
    maxTokens: 4000,
  },
};
