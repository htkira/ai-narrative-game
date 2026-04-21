import { useGameStore } from '@/store/gameStore';
import { Images, UI } from '@/utils/assets';
import styles from './StartScreen.module.css';

export function StartScreen() {
  const startGame = useGameStore((s) => s.startGame);

  return (
    <div className={styles.root}>
      <div
        className={styles.backdrop}
        style={{ backgroundImage: `url(${Images.scene})` }}
      />
      <div className={styles.vignette} />

      <div className={styles.content}>
        <h1 className={styles.title}>九劫真经</h1>
        <p className={styles.engTitle}>Chrysalis Codex: Nine Trials</p>

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerDot} />
          <span className={styles.dividerLine} />
        </div>

        <p className={styles.chapter}>第一世 · 第一幕</p>
        <p className={styles.location}>白家村</p>

        <button
          className={styles.startBtn}
          style={{ backgroundImage: `url(${UI.startButton})` }}
          onClick={startGame}
        >
          <span className={styles.startLabel}>踏入轮回</span>
        </button>
      </div>
    </div>
  );
}
