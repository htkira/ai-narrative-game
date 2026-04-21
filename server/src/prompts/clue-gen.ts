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
1. **直接线索**: 为每个hasClue=true的物品（包括true_clue和false_clue）生成**恰好1条**线索
   - clueId格式: clue_xxx（如clue_herb, clue_struggle, clue_scratch）
   - sourceItemId指向对应物品
   - type根据内容选择: pathology/pharmacology/conflict_trace/misc
   - usableAsEvidence=true
   - **true_clue物品的线索**分为两种（参见下方"线索强度"说明）：
     - 关键线索：能直接否定NPC错误前提的决定性证据
     - 补充线索：提供与该推理线相关的事实观察，但不足以否定NPC的错误归因
   - **false_clue物品的线索**：看似可疑的观察，但其内容只是描述一个表面现象，无法否定NPC任何一条观点的错误前提。**伪线索的摘要绝不能主动说出"与今日之事无关""无法判断关联""只是寻常现象"之类否定自身价值的结论**——如果线索自己说了"这跟案子没关系"，玩家就不会把它当作物证候选，失去了干扰作用。正确做法是只给出观察和初步推测，让玩家自己判断是否有用。

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

5. **线索强度（极其重要！）**:
   每个物品已标注了 evidenceLines 和 category。线索的强度取决于物品类别：

   - **关键线索**（来自true_clue、evidenceLines含A/B/D的物品中被选为"关键物证"的那一个）：包含郎中的专业判断结论，能直接否定NPC的错误前提。每条辩论推理线（A/B/D）有且仅有1条关键线索。
   - **补充线索**（来自true_clue、同一推理线上的其他物品）：提供与该推理线相关的真实观察（如"有骨粉散落"对D线、"有打斗痕迹"对B线），但**停留在现象描述层面，不包含能否定NPC错误归因的专业判断**。玩家拿这种线索去辩论会被NPC轻松驳回（"所以呢？这不正说明是被妖怪弄的吗？"）
   - **干扰线索**（来自false_clue物品）：看起来有关联但实际上无法否定任何NPC观点。例如描述一个看似异常的物质/痕迹，但它与A/B/D三条推理线的核心矛盾无关。

6. **线索覆盖要求**:
   每个物品已标注了 evidenceLines，表示该物品承载的推理线。请严格按照标注生成对应推理线的线索。每条推理线至少有1条关键线索 + 1条补充线索。

   各推理线方向参考：
   - A（死者死前状态异常）：药方/药渣成分、患者发病体征痕迹等
   - B（双向对抗——不是单方面行凶）：线索的核心作用是证明冲突是**双向搏斗**而非单方面施暴。仅仅证明"这里发生过激烈打斗"是不够的（NPC也会承认有打斗，只是认为是白姑单方面行凶）。线索必须体现**患者一方也在主动反击或发疯攻击**的痕迹——例如：患者抓挠/咬合留下的伤痕方向、从患者位置出发的攻击性碰撞（如褥席方向向外的冲击）、患者握持过武器/工具的痕迹、双向分布的血迹或碰撞点等。郎中应凭专业判断指出"这些痕迹不可能是单方面施加的"或"这里明显有来自两个方向的力"
   - C（有外来者来过现场，不能说"白姑"的名字）：不属于屋主的异常痕迹、材质、物质等
   - D（收集搬运——不是食人吞骨）：线索的核心作用是证明骨骼/物品是被**有序收集并小心搬走**的，而非被暴力吞食。仅仅证明"有东西不见了"或"留下了碎屑"是不够的（NPC也会说"骨头没了，肯定被吃了"）。线索必须体现**人为整理、包裹、搬运**的痕迹——例如：残留的捆扎纤维/布条碎屑、有规律的擦拭拖移痕（而非啃咬撕扯）、骨粉残留呈堆放/倾倒状（而非散乱咀嚼状）、容器/包袱被使用过的压痕折痕、搬运路径上连续的负重拖痕等。郎中应凭专业判断指出"这不像野兽撕咬啃食后的残留，更像是有人刻意收拢、包好后带走的"
   - E（外来者行为不像"食人妖怪"，通常由念珠残念提供）：动作带有小心、犹豫、悲悯等非攻击性特征

   **关键线索 vs 补充线索示例（以D线为例）**：
   - 关键线索（能反驳"食人吞骨"）："残留的碎屑旁有整齐的擦拭痕和布条纤维，凭我的经验，这分明是有人用布包裹后小心搬走的，绝非野兽撕咬啃食所能留下。"
   - 补充线索（不能反驳，只描述现象）："地上散落着灰白色骨粉碎屑，看来屋里的骨头确实遭到了破坏。" ← NPC可以轻松回应"所以呢？被妖怪嚼碎的呗"

7. **线索内容约束**:
  - 线索是主角（一个游方郎中）基于自身职业能力对物品的观察总结。线索的核心作用是为玩家提供可在辩论中使用的实质性证据，同时保持角色代入感。
  - **专业判断优先**：主角虽然不是侦探，但他是一个行医多年的郎中，在病理、药理、外伤、体征等方面有扎实的专业判断力。线索摘要应体现这种专业性——主角能辨认药渣成分、判断伤口成因、识别异常体征等。例如："药渣中混有少量雄黄粉，这并非治病之物，反而可能加重癫狂之症"比"这药渣里好像有什么奇怪的东西？"更能帮助玩家在辩论中使用。
  - **给出实质内容但不点破全局**：线索应当给出物品层面的具体判断（如"这是什么物质""这种伤是怎么形成的""这种症状说明了什么"），但不能跳跃到故事全局真相（如直接说出谁杀了谁、白姑的真实身份和动机等）。换言之，每条线索是一块拼图——它自身的信息是明确的，但整幅画需要玩家自己拼。
  - **严禁泄露骨架真相**：不得以任何形式（包括括号注释、举例、类比等）提及玩家尚无法得知的信息，如"白姑""爪""骸骨"等概念。线索只能基于物品上可直接观察到的物理证据进行专业推断。
  - **语气与代入感**：使用郎中的第一人称内心独白式语气，有职业自信但措辞留有余地。好的模式："凭我行医的经验，这分明是……""我敢断定这种痕迹是……不过，为何会出现在这里？"。避免纯疑问句式（如"这是什么呢？"），也避免法医报告式的冰冷断言。

### 数量要求
- 直接线索: 与hasClue=true的物品数量一致（包括true_clue和false_clue物品）
- 念珠残念线索: 与beadReactive=true的物品数量一致
- 总计应有8-14条线索`),
    ];
  },
  defaultOptions: {
    temperature: 0.7,
    maxTokens: 4000,
  },
};
