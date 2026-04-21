import type { NPC, Claim, AttitudeStage } from '@/types/game';
import type { DebateInitData, DebateContext, DebateResponse, EvidenceResult } from '@/types/content';
import { clueDefinitions, items } from './exploration';

// ---- NPC ----

const villageChief: NPC = {
  npcId: 'npc_chief',
  name: '村长',
  role: '白家村村长',
  tone: '强硬、武断、深信白姑是妖怪',
  currentSpeech: '',
  attitudeStage: 'assertive',
};

// ---- 观点 ----

const claims: Claim[] = [
  {
    claimId: 'claim_demon',
    text: '白姑根本不是人！她是山里的女妖，专门蛊惑人心！',
    status: 'active',
    basis: '村民传言她深夜在山中采药，行踪诡秘，非人所为。',
    refutableByClueIds: ['clue_bead_basket'],
  },
  {
    claimId: 'claim_poison',
    text: '她那些草药，全是害人的毒物！吃了她药的人，没一个好下场！',
    status: 'active',
    basis: '村中多人服药后病情加重，甚至有人不治身亡。',
    refutableByClueIds: ['clue_herb', 'clue_bead_bowl'],
  },
  {
    claimId: 'claim_murder',
    text: '村里死的人，都是她害的！人都死了，骨头也没剩全，除了那个女妖还有谁！',
    status: 'active',
    basis: '死者生前都曾服用白姑所配汤药，且屋中遍布挣扎痕迹。',
    refutableByClueIds: ['clue_bowl', 'clue_struggle'],
  },
];

const OPENING_SPEECH =
  '哼！你这外乡人，少在这里多管闲事！白姑的事情，全村人心里都清楚。' +
  '她就是个祸害！要不是她，村里怎么会死人？我劝你少替她说话，免得引火烧身！';

export const debateInitData: DebateInitData = {
  npc: villageChief,
  claims,
  openingSpeech: OPENING_SPEECH,
};

// ---- 态度阶段话术映射 ----

const ATTITUDE_ORDER: AttitudeStage[] = [
  'assertive',
  'defensive',
  'shaken',
  'retreating',
  'confessing',
];

function getNextAttitude(current: string): AttitudeStage {
  const idx = ATTITUDE_ORDER.indexOf(current as AttitudeStage);
  if (idx === -1 || idx >= ATTITUDE_ORDER.length - 1) return 'confessing';
  return ATTITUDE_ORDER[idx + 1]!;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// ---- 追问逻辑 ----

const questionResponses: Record<string, string[]> = {
  claim_demon: [
    '她半夜在山里出没，采些乱七八糟的草，正常人谁会这样？',
    '你没看见她那双眼睛？阴恻恻的，一看就不是凡人！',
    '村东头的李婶说，她见过白姑在月光下念咒语，浑身冒着绿光！',
  ],
  claim_poison: [
    '王大叔吃了她的药，第二天就卧床不起，你说不是毒是什么？',
    '她那药铺里瓶瓶罐罐的，谁知道装的是什么！',
    '好好的人，吃了她的药就出事，这还不够说明问题吗？',
  ],
  claim_murder: [
    '这还用问？人都死了，骨头也没剩全，除了那个女妖，还有谁会碰这些晦气东西？她不是食人，难不成还是替人收尸来的？',
    '张家的孩子失踪那天，有人看见白姑往山里去了！',
    '死的人都跟她有来往，你自己算算！',
  ],
};

const genericQuestionResponses = [
  '你问来问去的，我该说的都说了！',
  '我一个老头子还能骗你不成？事实摆在那里！',
  '你自己到村里打听打听，看看谁不说白姑的不好！',
];

export function mockProcessQuestion(_text: string, context: DebateContext): DebateResponse {
  const { currentClaimId } = context;

  const responses = currentClaimId ? questionResponses[currentClaimId] : null;
  const npcSpeech = responses ? pickRandom(responses) : pickRandom(genericQuestionResponses);

  return {
    npcSpeech,
    claimUpdate: undefined,
    attitudeChange: undefined,
  };
}

// ---- 出示物证逻辑 ----

function getClueIdsForEvidence(evidenceId: string): string[] {
  const item = items.find((i) => i.itemId === evidenceId);
  if (!item) return [];

  const result: string[] = [];
  if (item.clueId) result.push(item.clueId);

  for (const clueDef of clueDefinitions) {
    if (
      clueDef.sourceItemId === evidenceId &&
      clueDef.type === 'bead_memory' &&
      !result.includes(clueDef.clueId)
    ) {
      result.push(clueDef.clueId);
    }
  }

  return result;
}

const hitSpeeches: Record<string, string> = {
  claim_demon:
    '你……你说她只是在采药？可是……可是村里人都说她是妖啊！' +
    '难道……大家都看错了？',
  claim_poison:
    '什么？！有人在药碗里做了手脚？这……这怎么可能！' +
    '她的药本来就是……不，等等……如果药本身没问题……那到底是谁？',
  claim_murder:
    '这些痕迹……确实不像是她一个人能留下的。' +
    '难道……屋里的打斗不是她造成的？那这一切……',
};

const missSpeeches = [
  '这能说明什么？跟我说的有什么关系！',
  '别拿些不相干的东西来糊弄我！',
  '哼，你拿这个出来，反倒说明你也没什么真凭实据。',
];

export function mockProcessEvidence(
  evidenceId: string,
  claimId: string,
  _text?: string,
): EvidenceResult {
  const claim = claims.find((c) => c.claimId === claimId);
  if (!claim) {
    return {
      hit: false,
      npcSpeech: '你在说什么？我听不懂。',
    };
  }

  const clueIds = getClueIdsForEvidence(evidenceId);
  const hit = clueIds.some((cId) => claim.refutableByClueIds.includes(cId));

  if (!hit) {
    return {
      hit: false,
      npcSpeech: pickRandom(missSpeeches),
    };
  }

  const remainingActive = claims.filter(
    (c) => c.claimId !== claimId && c.status !== 'refuted',
  );
  const allWillBeRefuted = remainingActive.length === 0;

  const nextAttitude = getNextAttitude(
    allWillBeRefuted ? 'retreating' : 'defensive',
  );

  const result: EvidenceResult = {
    hit: true,
    npcSpeech: hitSpeeches[claimId] ?? '这……我需要再想想……',
    claimUpdate: {
      claimId,
      newStatus: 'refuted',
    },
    attitudeChange: nextAttitude,
  };

  if (allWillBeRefuted) {
    result.destinationUnlocked = true;
  }

  return result;
}

// ---- 幕终文本 ----

export const endingText =
  '你收好念珠，转身走向屋外。山间的风带着泥土与草木的气息拂面而来，' +
  '远处隐约可以听到泉水的声音。';
