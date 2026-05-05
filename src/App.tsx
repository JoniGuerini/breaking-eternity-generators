import { useEffect, useState } from 'react';
import { AppSidebar } from './components/AppSidebar';
import { GeneratorList } from './components/GeneratorList';
import { Header } from './components/Header';
import { HistoryModal } from './components/HistoryModal';
import { PlaytimePanel } from './components/PlaytimePanel';
import { ResetModal } from './components/ResetModal';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { UpgradesModal } from './components/UpgradesModal';
import { startGameLoop } from './game/loop';
import { useWakeLock } from './hooks/useWakeLock';

export function App() {
  const [resetOpen, setResetOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [upgradesOpen, setUpgradesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    startGameLoop();
  }, []);

  useWakeLock();

  return (
    <>
      <main className="container">
        <AppSidebar
          onRequestReset={() => setResetOpen(true)}
          onRequestThemeSelect={() => setThemeOpen(true)}
          onRequestUpgrades={() => setUpgradesOpen(true)}
          onRequestHistory={() => setHistoryOpen(true)}
        />
        {/* Em telas largas, o painel é `position: fixed` (canto superior
         *  direito), então a posição no DOM não importa. Em telas estreitas
         *  ele entra no fluxo logo após a sidebar empilhada — fica acima do
         *  Header como esperado. */}
        <PlaytimePanel />
        <Header />
        <GeneratorList />
      </main>
      <ResetModal open={resetOpen} onClose={() => setResetOpen(false)} />
      <ThemeSelectorModal open={themeOpen} onClose={() => setThemeOpen(false)} />
      <UpgradesModal open={upgradesOpen} onClose={() => setUpgradesOpen(false)} />
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  );
}
