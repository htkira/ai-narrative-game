import { STORY_SKELETON } from './story-skeleton.js';
import { system, user, type PromptTemplate } from './types.js';
import { defineSchema, enumSchema } from '../llm/index.js';

// ============================================================
// 1. Question Response Prompt
// ============================================================

export interface QuestionPromptInput {
  npcName: string;
  npcTone: string;
  attitudeStage: string;
  currentClaimText: string;
  currentClaimBasis: string;
  claimsOverview: string;
  recentHistory: string;
  playerQuestion: string;
}

const questionResponseSchema = defineSchema({
  npcSpeech: {
    type: 'string',
    description: 'NPC回应，40-100字，符合当前态度阶段',
  },
  claimUpdateClaimId: {
    type: 'string',
    description: '被动摇的观点ID（空字符串表示无变化）',
  },
  claimUpdateNewStatus: enumSchema(['active', 'weakened', 'none']),
  attitudeHint: {
    type: 'string',
    description: '态度变化的叙述提示（空字符串表示无变化）',
  },
});

export const questionResponsePrompt: PromptTemplate<QuestionPromptInput> = {
  name: 'debate-question',
  outputSchema: {
    name: 'debate_question_response',
    description: 'NPC response to player question during debate',
    schema: questionResponseSchema,
  },
  buildMessages: (input: QuestionPromptInput) => [
    system(`${STORY_SKELETON}

你正在扮演NPC"${input.npcName}"与玩家进行辩论。

## 角色状态
- 说话风格: ${input.npcTone}
- 当前态度: ${input.attitudeStage}
- 当前讨论的观点: ${input.currentClaimText}
- 观点论据: ${input.currentClaimBasis}

## 回应规则
1. 保持${input.npcName}的角色特征：山村长辈、惊慌但固执
2. 绝不主动驳倒自己的观点，只通过回应暴露逻辑漏洞
3. 可以含糊其辞、转移话题、或用情绪性语言掩饰弱点
4. 如果玩家的追问切中要害，可以将对应观点标记为"weakened"
5. "weakened"仅意味着论据被动摇，NPC仍不认输
6. 态度阶段为${input.attitudeStage}时的说话特征：
   - assertive: 强硬指控，不容反驳
   - defensive: 有些慌张但仍嘴硬
   - shaken: 明显心虚，开始自相矛盾
   - retreating: 支支吾吾，不断改口
7. 回应要自然、口语化，带有中国古代山村的语气
8. 使用第一人称（NPC视角），不要用"你"称呼自己`),
    user(`## 所有观点概览
${input.claimsOverview}

## 近期对话
${input.recentHistory}

## 玩家追问
"${input.playerQuestion}"

请以${input.npcName}的身份回应。`),
  ],
  defaultOptions: {
    temperature: 0.85,
    maxTokens: 1000,
  },
};

// ============================================================
// 2. Evidence Hit Response Prompt
// ============================================================

export interface EvidenceHitPromptInput {
  npcName: string;
  npcTone: string;
  attitudeStage: string;
  refutedClaimText: string;
  refutedClaimBasis: string;
  evidenceTitle: string;
  evidenceSummary: string;
  remainingActiveClaims: number;
  claimsOverview: string;
  recentHistory: string;
}

const evidenceHitSchema = defineSchema({
  npcSpeech: {
    type: 'string',
    description: 'NPC被驳倒后的退让/后撤话术，40-100字',
  },
  attitudeHint: {
    type: 'string',
    description: '态度变化的叙述描述',
  },
});

export const evidenceHitPrompt: PromptTemplate<EvidenceHitPromptInput> = {
  name: 'debate-evidence-hit',
  outputSchema: {
    name: 'debate_evidence_hit',
    description: 'NPC retreat response when evidence successfully refutes a claim',
    schema: evidenceHitSchema,
  },
  buildMessages: (input: EvidenceHitPromptInput) => [
    system(`${STORY_SKELETON}

你正在扮演NPC"${input.npcName}"。玩家刚刚出示了决定性证据，成功驳倒了你的一条观点。

## 角色状态
- 说话风格: ${input.npcTone}
- 态度阶段: ${input.attitudeStage}
- 剩余未被驳倒的观点数: ${input.remainingActiveClaims}

## 被驳倒的观点
"${input.refutedClaimText}"
论据: ${input.refutedClaimBasis}

## 玩家出示的证据
线索: ${input.evidenceTitle}
内容: ${input.evidenceSummary}

## 回应规则
1. NPC必须承认这条观点站不住脚，但态度不情愿
2. 根据态度阶段调整反应强度：
   - defensive: 嘴硬但不得不认，"好，这条是我说急了，可是……"
   - shaken: 明显慌张，"这……这也不能说明……算了，这条不提了"
   - retreating: 声音发虚，开始怀疑自己的其他观点
3. 可以尝试转到其他观点上，但不能否认证据的有效性
4. 回应自然口语化，带有山村长辈特征
5. 不要提及玩家不可能知道的信息`),
    user(`## 所有观点概览
${input.claimsOverview}

## 近期对话
${input.recentHistory}

请以${input.npcName}的身份回应被驳倒的反应。`),
  ],
  defaultOptions: {
    temperature: 0.8,
    maxTokens: 800,
  },
};

// ============================================================
// 3. Evidence Miss Response Prompt
// ============================================================

export interface EvidenceMissPromptInput {
  npcName: string;
  npcTone: string;
  attitudeStage: string;
  targetClaimText: string;
  evidenceTitle: string;
  evidenceSummary: string;
  playerText: string;
  recentHistory: string;
}

const evidenceMissSchema = defineSchema({
  npcSpeech: {
    type: 'string',
    description: 'NPC防御性回应，30-80字',
  },
});

export const evidenceMissPrompt: PromptTemplate<EvidenceMissPromptInput> = {
  name: 'debate-evidence-miss',
  outputSchema: {
    name: 'debate_evidence_miss',
    description: 'NPC defensive response when wrong evidence is presented',
    schema: evidenceMissSchema,
  },
  buildMessages: (input: EvidenceMissPromptInput) => [
    system(`${STORY_SKELETON}

你正在扮演NPC"${input.npcName}"。玩家出示了一条证据试图驳倒你的观点，但这条证据并不能有效驳倒当前观点。

## 角色状态
- 说话风格: ${input.npcTone}
- 态度阶段: ${input.attitudeStage}

## 玩家试图驳倒的观点
"${input.targetClaimText}"

## 玩家出示的证据
线索: ${input.evidenceTitle}
内容: ${input.evidenceSummary}
${input.playerText ? `玩家说: "${input.playerText}"` : ''}

## 回应规则
1. NPC应当反驳玩家：这条证据不足以推翻观点
2. 态度比之前更强硬一些，趁机巩固自己的立场
3. 可以嘲笑或质疑玩家的推理能力
4. 但不要太过分，保持山村长辈的底线
5. 回应简短有力`),
    user(`## 近期对话
${input.recentHistory}

请以${input.npcName}的身份回应玩家出示错误证据的情况。`),
  ],
  defaultOptions: {
    temperature: 0.8,
    maxTokens: 600,
  },
};

// ============================================================
// 4. Confession Prompt (all claims refuted)
// ============================================================

export interface ConfessionPromptInput {
  npcName: string;
  npcTone: string;
  claimsOverview: string;
  recentHistory: string;
}

const confessionSchema = defineSchema({
  npcSpeech: {
    type: 'string',
    description:
      'NPC完整台词（120-200字），自然串联三个部分：①松口坦白 → ②引出白姑去向（后山泉） → ③引导/催促玩家前往',
  },
});

export const confessionPrompt: PromptTemplate<ConfessionPromptInput> = {
  name: 'debate-confession',
  outputSchema: {
    name: 'debate_confession',
    description: 'NPC final confession when all claims are refuted',
    schema: confessionSchema,
  },
  buildMessages: (input: ConfessionPromptInput) => [
    system(`${STORY_SKELETON}

你正在扮演NPC"${input.npcName}"。玩家已经逐一驳倒了你的所有指控观点。你不得不松口。

## 角色状态
- 说话风格: ${input.npcTone}（但此时已是confessing态度）
- 所有观点都被驳倒

## 白姑去向（固定设定）
白姑的去向是**后山泉**。NPC知道这个地方——村后有条小路上山，沿溪走到头就是后山泉。这是村中人都知道的地点，但平时没人愿意去，因为觉得那地方邪气重。

## 台词结构要求
npcSpeech 必须是一段完整的、自然连贯的台词（120-200字），包含以下三个部分，三部分之间必须自然过渡，不能生硬拼接：

**第一部分：松口坦白**
- NPC终于松口，不再坚持白姑是凶手的立场
- 态度转变应自然：从最后的抵抗到不情愿地接受事实
- NPC不掌握完整真相，他的松口是"不再坚持指控"，不是"知道了真相"
- 语气复杂：有释然、有不甘、有无奈

**第二部分：引出去向**
- 从坦白自然过渡到提及白姑的去向——后山泉
- 不能生硬地说"有人看到白姑去了后山泉"，而应融入NPC自己的叙述逻辑中
- 好的过渡例如："既然你非要追究……我只知道……""也罢，你若是好奇真相就自己去问吧……"
- NPC透露去向的动机可以是：觉得既然自己说不过、不如让主角自己去看看；或者不经意间透露了自己知道的信息

**第三部分：引导前往**
- 承接去向信息，自然地引导/催促/暗示玩家应该去后山泉看看
- 可以是善意提醒、赌气挑衅、或者无奈的指路——取决于NPC性格
- 例如带上路径提示（"村后小路上山，沿溪走到头便是"之类的具体方位指引）
- 可以附带警告、不安、或对未知的恐惧

## 其他规则
- 回应自然口语化，带有山村人物特征
- 不要提及玩家不可能知道的信息`),
    user(`## 被驳倒的观点概览
${input.claimsOverview}

## 辩论历程
${input.recentHistory}

请以${input.npcName}的身份，生成最终松口文本和白姑去向信息。`),
  ],
  defaultOptions: {
    temperature: 0.85,
    maxTokens: 1000,
  },
};
