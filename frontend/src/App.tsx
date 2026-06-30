import { GameScreen } from "@/components/screens/GameScreen";
import { LobbyScreen } from "@/components/screens/LobbyScreen";
import { ResultScreen } from "@/components/screens/ResultScreen";
import { StartScreen } from "@/components/screens/StartScreen";
import { useGameStore } from "@/store/gameStore";

const SCREENS = {
  start: StartScreen,
  lobby: LobbyScreen,
  game: GameScreen,
  result: ResultScreen,
} as const;

function App() {
  const screen = useGameStore((s) => s.screen);
  const Screen = SCREENS[screen];
  return <Screen />;
}

export default App;
