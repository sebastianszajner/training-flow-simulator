import { useEffect, useState } from 'react';
import { useProjectStore } from './store/projectStore';
import Header from './components/shared/Header';
import ProjectSetup from './components/ProjectSetup/ProjectSetup';
import TimelineBuilder from './components/TimelineBuilder/TimelineBuilder';
import RoomBuilder from './components/RoomBuilder/RoomBuilder';
import Simulation from './components/Simulation/Simulation';
import ExportView from './components/Export/ExportView';

function App() {
  const { project, currentScreen, setScreen } = useProjectStore();
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    if (!project && currentScreen !== 'setup') {
      setScreen('setup');
    }
  }, [project, currentScreen, setScreen]);

  if (showExport && project) {
    return (
      <div className="min-h-screen bg-white">
        <div className="no-print p-4 bg-slate-900 flex items-center gap-4">
          <button
            onClick={() => setShowExport(false)}
            className="text-white hover:text-blue-400 text-sm"
          >
            ← Back to editor
          </button>
        </div>
        <ExportView />
      </div>
    );
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'setup':
        return <ProjectSetup />;
      case 'timeline':
        return <TimelineBuilder />;
      case 'room':
        return <RoomBuilder />;
      case 'simulation':
        return <Simulation />;
      default:
        return <ProjectSetup />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      <Header onExport={() => setShowExport(true)} />
      {renderScreen()}
    </div>
  );
}

export default App;
