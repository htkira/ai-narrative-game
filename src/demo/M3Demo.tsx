import { useState } from 'react';
import { GameLayout, LeftPanel, CenterPanel, RightPanel } from '@/components/layout';
import {
  TextPanel,
  StreamText,
  ItemBar,
  ProgressBar,
  ActionButton,
  InputBox,
} from '@/components/shared';
import type { ItemBarItem } from '@/components/shared';
import { Images, UI } from '@/utils/assets';

const DEMO_TEXT =
  '你从冰冷坚硬的地面上缓缓醒来，后脑仍隐隐作痛。' +
  '昏黄天光从破旧窗纸里漏进来，照见满屋狼藉——' +
  '翻倒的木凳、碎裂的陶碗、泼洒一地的药渣与水迹。';

const DEMO_ITEMS: ItemBarItem[] = [
  { itemId: 'item_1', iconUrl: Images.item1, name: '竹篮' },
  { itemId: 'item_2', iconUrl: Images.item2, name: '药碗碎片' },
  { itemId: 'item_3', iconUrl: Images.item3, name: '破损窗纸' },
  { itemId: 'item_4', iconUrl: Images.item4, name: '翻倒木凳' },
];

const allAssets = [
  { label: 'scene.png', url: Images.scene },
  { label: 'item-1.png', url: Images.item1 },
  { label: 'item-2.png', url: Images.item2 },
  { label: 'item-3.png', url: Images.item3 },
  { label: 'item-4.png', url: Images.item4 },
  { label: 'beads.png', url: Images.bead },
  { label: 'npc.png', url: Images.character },
  { label: 'text-panel.png', url: UI.textBackground },
  { label: 'inventory-panel.png', url: UI.itemBar },
  { label: 'progress-bar.png', url: UI.progressBar },
  { label: 'memory-skill.png', url: UI.beadSkillIcon },
  { label: 'input-box.png', url: UI.inputBox },
  { label: 'debate-button.png', url: UI.actionButton },
];

export function M3Demo() {
  const [inputVal, setInputVal] = useState('');
  const [selectedItem, setSelectedItem] = useState<string | null>('item_1');
  const [streamKey, setStreamKey] = useState(0);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ---- 主布局演示 ---- */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <GameLayout
          left={
            <LeftPanel
              imageUrl={Images.scene}
              imageAlt="场景图片"
              footer={<ProgressBar label="线索" current={3} total={10} />}
            />
          }
          center={
            <CenterPanel>
              <TextPanel
                topContent={
                  <StreamText
                    key={streamKey}
                    text={DEMO_TEXT}
                    speed={35}
                    onComplete={() => console.log('[StreamText] done')}
                  />
                }
                bottomContent={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <ActionButton onClick={() => alert('追问')}>追问疑点</ActionButton>
                      <ActionButton onClick={() => alert('出示')}>出示物证</ActionButton>
                      <ActionButton disabled>已禁用</ActionButton>
                    </div>
                    <InputBox
                      value={inputVal}
                      onChange={setInputVal}
                      onSubmit={() => alert(`提交: ${inputVal}`)}
                      placeholder="输入你的追问…"
                    />
                    <ActionButton onClick={() => setStreamKey((k) => k + 1)}>
                      重播文字
                    </ActionButton>
                  </div>
                }
              />
            </CenterPanel>
          }
          right={
            <RightPanel
              footer={
                <img
                  src={UI.beadSkillIcon}
                  alt="佛珠技能"
                  style={{ width: 48, height: 48, imageRendering: 'pixelated' }}
                />
              }
            >
              <ItemBar
                items={DEMO_ITEMS}
                selectedItemId={selectedItem}
                onItemClick={(id) => setSelectedItem(id)}
              />
            </RightPanel>
          }
        />
      </div>

      {/* ---- 资源清单面板 ---- */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(0,0,0,0.92)',
          borderTop: '2px solid #5a3e2b',
          padding: '10px 16px',
          zIndex: 1000,
          overflowX: 'auto',
        }}
      >
        <div style={{ fontSize: 12, color: '#c9a84c', marginBottom: 6 }}>
          资源加载检查 — 共 {allAssets.length} 项（绿框=已加载 / 红框=加载失败）
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'nowrap' }}>
          {allAssets.map((a) => (
            <AssetThumb key={a.label} label={a.label} url={a.url} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AssetThumb({ label, url }: { label: string; url: string }) {
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <div style={{ textAlign: 'center', flexShrink: 0 }}>
      <div
        style={{
          width: 56,
          height: 56,
          border: `2px solid ${ok === false ? '#e74c3c' : ok === true ? '#27ae60' : '#555'}`,
          borderRadius: 4,
          overflow: 'hidden',
          background: '#111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={url}
          alt={label}
          style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated' }}
          onLoad={() => setOk(true)}
          onError={() => setOk(false)}
        />
      </div>
      <div style={{ fontSize: 9, color: '#aaa', marginTop: 2, maxWidth: 60, wordBreak: 'break-all' }}>
        {label}
      </div>
    </div>
  );
}
