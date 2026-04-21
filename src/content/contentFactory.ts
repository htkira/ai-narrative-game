import type { IContentProvider } from '@/types/content';
import { MockContentProvider } from './MockContentProvider';
import { ApiContentProvider } from './ApiContentProvider';

let _instance: IContentProvider | null = null;

/**
 * 获取当前内容提供器的单例。
 *
 * 通过环境变量 VITE_USE_REAL_API 切换实现：
 * - 默认 / 'false' → MockContentProvider（本地 mock 数据）
 * - 'true' → ApiContentProvider（后端 BFF）
 */
export function getContentProvider(): IContentProvider {
  if (_instance) return _instance;

  const useRealApi = import.meta.env.VITE_USE_REAL_API === 'true';

  if (useRealApi) {
    _instance = new ApiContentProvider();
  } else {
    _instance = new MockContentProvider();
  }

  return _instance;
}

/** 用于测试：重置单例，下次 getContentProvider 时重新创建 */
export function resetContentProvider(): void {
  _instance = null;
}
