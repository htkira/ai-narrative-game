// ============================================================
// 资产加载工具
// 集中管理所有 assets/ 目录下的静态资源引用
// Vite 会在构建时处理这些 import，生成正确的 URL
// ============================================================

// ---- UI 皮肤资源 (assets/ui/) ----

import uiTextBg from '@assets/ui/text-panel.png';
import uiItemBar from '@assets/ui/inventory-panel.png';
import uiProgressBar from '@assets/ui/progress-bar.png';
import uiBeadSkillIcon from '@assets/ui/memory-skill.png';
import uiInputBox from '@assets/ui/input-box.png';
import uiActionButton from '@assets/ui/debate-button.png';
import uiStartButton from '@assets/ui/start-button.png';
import uiPreInventory from '@assets/ui/pre-inventory-panel.png';

// ---- 内容图片资源 (assets/images/) ----

import imgScene from '@assets/images/scene.png';
import imgOpeningScene from '@assets/images/opening-scene.png';
import imgItem1 from '@assets/images/item-1.png';
import imgItem2 from '@assets/images/item-2.png';
import imgItem3 from '@assets/images/item-3.png';
import imgItem4 from '@assets/images/item-4.png';
import imgItem5 from '@assets/images/item-5.png';
import imgItem6 from '@assets/images/item-6.png';
import imgItem7 from '@assets/images/item-7.png';
import imgItem8 from '@assets/images/item-8.png';
import imgItem9 from '@assets/images/item-9.png';
import imgBead from '@assets/images/beads.png';
import imgCharacter from '@assets/images/npc.png';

/** UI 皮肤资源 —— 用作界面组件的背景 / 底板 */
export const UI = {
  textBackground: uiTextBg,
  itemBar: uiItemBar,
  progressBar: uiProgressBar,
  beadSkillIcon: uiBeadSkillIcon,
  inputBox: uiInputBox,
  actionButton: uiActionButton,
  startButton: uiStartButton,
  preInventory: uiPreInventory,
} as const;

/** 内容图片资源 —— 用于场景、物品、人物展示 */
export const Images = {
  scene: imgScene,
  item1: imgItem1,
  item2: imgItem2,
  item3: imgItem3,
  item4: imgItem4,
  item5: imgItem5,
  item6: imgItem6,
  item7: imgItem7,
  item8: imgItem8,
  item9: imgItem9,
  bead: imgBead,
  character: imgCharacter,
  openingScene: imgOpeningScene,
} as const;

/**
 * 根据物品 ID 获取对应图标 URL
 * mock 阶段物品 ID 与文件名的映射关系
 */
const itemIconMap: Record<string, string> = {
  item_1: imgItem1,
  item_2: imgItem2,
  item_3: imgItem3,
  item_4: imgItem4,
  item_5: imgItem5,
  item_6: imgItem6,
  item_7: imgItem7,
  item_8: imgItem8,
  item_9: imgItem9,
  item_bead: imgBead,
};

export function getItemIcon(itemId: string): string {
  return itemIconMap[itemId] ?? imgItem1;
}

/**
 * 根据场景 ID 获取场景图片 URL
 * 当前版本只有一个场景，未来扩展时在此添加映射
 */
export function getSceneImage(_sceneId: string): string {
  return imgScene;
}
