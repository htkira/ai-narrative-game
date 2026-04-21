import type { Scene, Zone, Item } from '@/types/game';
import type { BeadData, ClueDefinition, SceneData } from '@/types/content';
import { Images, getItemIcon } from '@/utils/assets';

// ---- 场景 ----

const scene: Scene = {
  sceneId: 'scene_herb_house',
  title: '白家村·药铺',
  description:
    '你从冰冷坚硬的地面上缓缓醒来，后脑仍隐隐作痛，胸口像压着一块石头。' +
    '昏黄天光从破旧窗纸里漏进来，照见满屋狼藉：翻倒的木凳、碎裂的陶碗、' +
    '泼洒一地的药渣与水迹，空气中混杂着草药苦味和一丝说不清的腥气。' +
    '屋中却静得出奇，不见半个人影。你努力回想自己为何会倒在这里，' +
    '脑中却只剩零碎而模糊的片段。' +
    '看来，想知道这里究竟发生了什么，只能先仔细查一查这间屋子了。',
  imageUrl: Images.scene,
  imageAlt: '昏暗的药铺内景，满地狼藉',
};

// ---- 区域 ----

const zones: Zone[] = [
  {
    zoneId: 'zone_window',
    name: '靠近窗户',
    summary: '破旧窗纸透进来的天光最亮处，窗棂歪斜，似乎被人推搡过。',
    itemIds: ['item_3', 'item_5', 'item_8'],
    unlocked: true,
  },
  {
    zoneId: 'zone_center',
    name: '调查屋子中央',
    summary: '屋子正中散落着碎碗与药渣，空气里草药味最浓。',
    itemIds: ['item_1', 'item_2', 'item_7'],
    unlocked: true,
  },
  {
    zoneId: 'zone_corner',
    name: '查看角落',
    summary: '阴暗角落堆着翻倒的家具，隐约有什么东西在微微发光。',
    itemIds: ['item_4', 'item_bead', 'item_6', 'item_9'],
    unlocked: true,
  },
];

// ---- 物品 ----

const items: Item[] = [
  {
    itemId: 'item_1',
    name: '竹篮',
    iconUrl: getItemIcon('item_1'),
    category: 'true_clue',
    zoneId: 'zone_center',
    description:
      '竹篮侧倒在地，编口已有些松散变形，边缘还沾着几点早已干掉的泥痕。' +
      '篮中原本似乎装过东西，如今却空了一半，只剩些零碎草叶和几缕断裂的草绳压在底部，' +
      '像是有人匆忙翻找过。你俯身细看，隐约能闻到一丝淡淡的草药气味。',
    isDiscovered: false,
    isExamined: false,
    hasClue: true,
    clueId: 'clue_herb',
    beadReactive: true,
    beadText: null,
    isBeadUnlocked: false,
    isEvidence: true,
  },
  {
    itemId: 'item_2',
    name: '药碗碎片',
    iconUrl: getItemIcon('item_2'),
    category: 'true_clue',
    zoneId: 'zone_center',
    description:
      '几片碎陶散落在湿漉漉的地面上，拼起来大约是一只粗釉药碗。' +
      '碗底残留着一层褐黑色的药渍，比寻常汤药颜色深了许多，' +
      '凑近还能闻到一股刺鼻的苦涩味。碎片边缘参差不齐，' +
      '看起来不像是自然掉落摔碎的，倒像被人用力摔在了地上。',
    isDiscovered: false,
    isExamined: false,
    hasClue: true,
    clueId: 'clue_bowl',
    beadReactive: true,
    beadText: null,
    isBeadUnlocked: false,
    isEvidence: true,
  },
  {
    itemId: 'item_3',
    name: '破损窗纸',
    iconUrl: getItemIcon('item_3'),
    category: 'atmosphere',
    zoneId: 'zone_window',
    description:
      '窗棂歪歪斜斜，上面糊的纸早已破了大半。透过残缺的窗纸望出去，' +
      '只见灰蒙蒙的天和几棵枯瘦的树。窗框上有几道新鲜的刮痕，' +
      '似乎有人曾试图从窗户离开——或者进来。',
    isDiscovered: false,
    isExamined: false,
    hasClue: false,
    clueId: null,
    beadReactive: false,
    beadText: null,
    isBeadUnlocked: false,
    isEvidence: false,
  },
  {
    itemId: 'item_4',
    name: '翻倒木凳',
    iconUrl: getItemIcon('item_4'),
    category: 'true_clue',
    zoneId: 'zone_corner',
    description:
      '一条厚实的木凳四脚朝天倒在墙角，凳腿上有几道深深的磕痕，' +
      '地面上也被砸出了一个浅坑。凳面边缘还挂着几缕不知是布还是发的纤维。' +
      '从翻倒的角度来看，这绝不是被不小心碰翻的——更像是在激烈的争执中被掀翻的。',
    isDiscovered: false,
    isExamined: false,
    hasClue: true,
    clueId: 'clue_struggle',
    beadReactive: false,
    beadText: null,
    isBeadUnlocked: false,
    isEvidence: true,
  },
  {
    itemId: 'item_5',
    name: '药方残页',
    iconUrl: getItemIcon('item_5'),
    category: 'true_clue',
    zoneId: 'zone_window',
    description:
      '窗台上压着半张泛黄的纸页，边缘卷曲发脆，墨迹已经有些洇开。' +
      '上面用蝇头小楷写着一剂汤药的配方，但某些药材的用量被人用朱笔重重改过——' +
      '原本的数字被划去，旁边写上了明显偏大的剂量。' +
      '纸页的另一半被撕掉了，不知去向。撕裂处的纤维参差不齐，像是被人匆忙扯断的。',
    isDiscovered: false,
    isExamined: false,
    hasClue: true,
    clueId: 'clue_prescription',
    beadReactive: false,
    beadText: null,
    isBeadUnlocked: false,
    isEvidence: true,
  },
  {
    itemId: 'item_6',
    name: '烛台蜡渍',
    iconUrl: getItemIcon('item_6'),
    category: 'atmosphere',
    zoneId: 'zone_corner',
    description:
      '角落里一只铜烛台歪斜地靠在墙边，上面凝结着厚厚的蜡渍，' +
      '层层叠叠宛如微型石钟乳。烛台底部还残留着最后一小截蜡烛，已经燃尽了。' +
      '看起来这间屋子的主人经常挑灯到深夜。',
    isDiscovered: false,
    isExamined: false,
    hasClue: false,
    clueId: null,
    beadReactive: false,
    beadText: null,
    isBeadUnlocked: false,
    isEvidence: false,
  },
  {
    itemId: 'item_7',
    name: '绣帕',
    iconUrl: getItemIcon('item_7'),
    category: 'true_clue',
    zoneId: 'zone_center',
    description:
      '地上散落着一方精致的绣帕，帕角绣着一枝素雅的兰花，针脚细密匀称。' +
      '帕面上隐约还有淡淡的药草香气，与屋中浓重的苦药味截然不同——' +
      '是一种清甜温和的气息。绣帕的一角被什么东西沾污了，留下几点暗红色的印渍。',
    isDiscovered: false,
    isExamined: false,
    hasClue: true,
    clueId: 'clue_handkerchief',
    beadReactive: true,
    beadText: null,
    isBeadUnlocked: false,
    isEvidence: true,
  },
  {
    itemId: 'item_8',
    name: '泥脚印',
    iconUrl: getItemIcon('item_8'),
    category: 'false_clue',
    zoneId: 'zone_window',
    description:
      '窗户下方的地面上有一串模糊的泥脚印，大小看上去像是成年男子的。' +
      '脚印从窗户方向延伸到屋内，又折返回去，似乎有人从窗户进来后又原路返回。' +
      '不过仔细辨认，这些泥印已经干透发硬，应该不是近日留下的。',
    isDiscovered: false,
    isExamined: false,
    hasClue: false,
    clueId: null,
    beadReactive: false,
    beadText: null,
    isBeadUnlocked: false,
    isEvidence: false,
  },
  {
    itemId: 'item_9',
    name: '锈铁钉',
    iconUrl: getItemIcon('item_9'),
    category: 'atmosphere',
    zoneId: 'zone_corner',
    description:
      '墙根处散落着几枚锈迹斑斑的铁钉，钉身弯曲变形，铁锈呈深褐色，' +
      '像是从什么家具上脱落的。钉子旁边的墙壁上还有几个小孔，' +
      '原本应该是用来挂什么东西的。这些钉子看起来已经锈蚀很久了，与屋内的打斗痕迹无关。',
    isDiscovered: false,
    isExamined: false,
    hasClue: false,
    clueId: null,
    beadReactive: false,
    beadText: null,
    isBeadUnlocked: false,
    isEvidence: false,
  },
  {
    itemId: 'item_bead',
    name: '残缺念珠',
    iconUrl: getItemIcon('item_bead'),
    category: 'special',
    zoneId: 'zone_corner',
    description:
      '角落的阴影中，一串断裂的念珠静静地躺在灰尘里，散落着几颗已经脱线的珠子。' +
      '念珠的材质说不上名来，不像木头也不像玉石，手指触上去时微微温热，' +
      '仿佛还残留着持有者的体温。你隐约觉得，这串珠子曾经属于一个很重要的人。',
    isDiscovered: false,
    isExamined: false,
    hasClue: false,
    clueId: null,
    beadReactive: false,
    beadText: null,
    isBeadUnlocked: false,
    isEvidence: false,
  },
];

// ---- 佛珠 ----

export const beadData: BeadData = {
  itemId: 'item_bead',
  name: '残缺念珠',
  description:
    '一串残缺的念珠，珠子温润微暖，似乎蕴含着某种不可言说的力量。' +
    '握在手中，你能隐隐感受到它与这间屋子里某些物件之间的联系。',
  iconUrl: Images.bead,
  hintText: '念珠微微发热，似乎感应到了什么……',
};

// ---- 残念文本 (佛珠感应) ----

export const beadRemnants: Record<string, string> = {
  item_1:
    '你握紧念珠靠近竹篮，眼前忽然浮现出一个模糊的画面——' +
    '一位身着素衣的女子正在山间采药，动作轻柔而熟练，' +
    '将一株株草药小心翼翼地放入竹篮。她的眼神温柔而专注，' +
    '嘴角带着浅浅的笑意，像是对这些草药怀有真挚的爱护。',
  item_2:
    '念珠贴近碎碗时突然变得滚烫，一个令人不安的画面闯入你的意识——' +
    '深夜里，一个黑影蹑手蹑脚地靠近药碗，从袖中取出一只小瓷瓶，' +
    '将瓶中灰白色的粉末倒入碗中，搅了几下便匆匆离去。' +
    '那粉末溶入药汤后，颜色变得深沉浑浊。',
  item_7:
    '念珠触碰绣帕的瞬间，一段令人心痛的画面涌入脑海——' +
    '一位女子手持绣帕擦拭额角的血迹，身前站着一个面目模糊的人影，' +
    '正对她厉声喝骂。女子没有退缩，反而挺直了腰板，语气坚定地说了什么。' +
    '那人影勃然大怒，猛地挥手打翻了桌上的药碗。',
};

// ---- 线索定义 ----

export const clueDefinitions: ClueDefinition[] = [
  {
    clueId: 'clue_herb',
    title: '采药痕迹',
    summary: '竹篮中残留的草叶与气味，说明此处的主人常年采集药草。这些草药气味温和，并非毒物。',
    sourceItemId: 'item_1',
    type: 'pharmacology',
    usableAsEvidence: true,
  },
  {
    clueId: 'clue_bowl',
    title: '异常药渍',
    summary: '碎碗中残留的药渍颜色异常深沉，与正常汤药截然不同，似乎被人掺入了别的东西。',
    sourceItemId: 'item_2',
    type: 'pathology',
    usableAsEvidence: true,
  },
  {
    clueId: 'clue_struggle',
    title: '打斗痕迹',
    summary: '翻倒的木凳与地面刮痕表明这里发生过激烈的肢体冲突，绝非自然倒塌。',
    sourceItemId: 'item_4',
    type: 'conflict_trace',
    usableAsEvidence: true,
  },
  {
    clueId: 'clue_bead_basket',
    title: '竹篮残念·采药女子',
    summary: '念珠感应到的画面中，白姑温柔地采药，分明是一位心怀慈悲的药师，而非害人的妖怪。',
    sourceItemId: 'item_1',
    type: 'bead_memory',
    usableAsEvidence: true,
  },
  {
    clueId: 'clue_bead_bowl',
    title: '药碗残念·投毒黑影',
    summary: '念珠显示有人趁夜在药碗中投入不明粉末，真正下毒之人另有其人。',
    sourceItemId: 'item_2',
    type: 'bead_memory',
    usableAsEvidence: true,
  },
  {
    clueId: 'clue_prescription',
    title: '篡改药方',
    summary: '药方上的用量被人用朱笔篡改，远超正常剂量，有人蓄意加重了药量。',
    sourceItemId: 'item_5',
    type: 'pharmacology',
    usableAsEvidence: true,
  },
  {
    clueId: 'clue_handkerchief',
    title: '白姑绣帕',
    summary: '绣帕上残留清甜药草香，帕角的兰花绣工精致，应是白姑随身之物。',
    sourceItemId: 'item_7',
    type: 'misc',
    usableAsEvidence: true,
  },
  {
    clueId: 'clue_bead_handkerchief',
    title: '绣帕残念·争执',
    summary: '念珠显示白姑曾用此帕包扎伤口，与人发生激烈争执后受了伤。',
    sourceItemId: 'item_7',
    type: 'bead_memory',
    usableAsEvidence: true,
  },
];

// ---- 物品描述映射 ----

export const itemDescriptions: Record<string, string> = Object.fromEntries(
  items.map((item) => [item.itemId, item.description]),
);

// ---- 组合导出 ----

export const sceneData: SceneData = { scene, zones, items };

export { items, zones };
