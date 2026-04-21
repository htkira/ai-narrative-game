import { useGameStore } from '@/store/gameStore';
import { StartScreen } from '@/phases/start/StartScreen';
import { OpeningScene } from '@/phases/opening/OpeningScene';
import { ExplorationScreen } from '@/phases/exploration/ExplorationScreen';
import { DebateScreen } from '@/phases/debate/DebateScreen';
import { EndingScreen } from '@/phases/ending/EndingScreen';

function App() {
  const phase = useGameStore((s) => s.phase);

  switch (phase) {
    case 'start':
      return <StartScreen />;
    case 'opening':
      return <OpeningScene />;
    case 'exploration':
      return <ExplorationScreen />;
    case 'debate':
      return <DebateScreen />;
    case 'ending':
      return <EndingScreen />;
    default:
      return <StartScreen />;
  }
}

export default App;
