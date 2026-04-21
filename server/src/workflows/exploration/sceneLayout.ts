import { executePrompt, sceneLayoutPrompt } from '../../prompts/index.js';
import type { SceneLayoutOutput, StepResult, ValidationResult, ValidationError } from './types.js';

export async function generateSceneLayout(): Promise<StepResult<SceneLayoutOutput>> {
  const result = await executePrompt<void, SceneLayoutOutput>(
    sceneLayoutPrompt,
    undefined,
  );

  return {
    data: result.data,
    usage: result.usage,
    durationMs: result.durationMs,
  };
}

export function validateSceneLayout(data: SceneLayoutOutput): ValidationResult {
  const errors: ValidationError[] = [];
  const step = 'sceneLayout';

  if (!data.scene.sceneId || !data.scene.sceneId.startsWith('scene_')) {
    errors.push({ step, rule: 'scene_id_format', message: `sceneId 格式应为 scene_xxx，实际为 "${data.scene.sceneId}"` });
  }

  if (!data.scene.title || data.scene.title.trim().length < 2) {
    errors.push({ step, rule: 'scene_title', message: '场景标题过短' });
  }

  if (!data.scene.description || data.scene.description.trim().length < 20) {
    errors.push({ step, rule: 'scene_description', message: '场景描述过短' });
  }

  if (!data.scene.imageAlt || data.scene.imageAlt.trim().length < 10) {
    errors.push({ step, rule: 'scene_image_alt', message: 'imageAlt 过短' });
  }

  if (!data.zones || data.zones.length < 2) {
    errors.push({ step, rule: 'min_zones', message: `至少需要2个区域，实际有${data.zones?.length ?? 0}个` });
  }

  if (data.zones && data.zones.length > 4) {
    errors.push({ step, rule: 'max_zones', message: `最多4个区域，实际有${data.zones.length}个` });
  }

  const zoneIdList = data.zones?.map((z) => z.zoneId) ?? [];
  const uniqueZoneIds = new Set(zoneIdList);
  if (uniqueZoneIds.size !== zoneIdList.length) {
    errors.push({ step, rule: 'unique_zone_ids', message: '存在重复的zoneId' });
  }

  for (const zone of data.zones ?? []) {
    if (!zone.zoneId || !zone.zoneId.startsWith('zone_')) {
      errors.push({ step, rule: 'zone_id_format', message: `zoneId 格式应为 zone_xxx，实际为 "${zone.zoneId}"` });
    }
    if (!zone.name || zone.name.trim().length < 2) {
      errors.push({ step, rule: 'zone_name', message: `区域 ${zone.zoneId} 名称过短` });
    }
  }

  return { valid: errors.length === 0, errors };
}
