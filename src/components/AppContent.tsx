interface AppContentProps {
  isReady: boolean;
  error: string | null;
}

export const AppContent: React.FC<AppContentProps> = ({ isReady, error }) => {
  if (error) {
    return (
      <div className="fixed inset-0 bg-gunmetal-900 flex items-center justify-center">
        <div className="text-center p-8 bg-gunmetal-800 rounded-lg">
          <h2 className="text-xl font-bold text-neon-red mb-4">Initialization Error</h2>
          <p className="text-white mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-neon-blue hover:bg-neon-blue/80 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <div className="app-container">
      <Router>
        <Sidebar />
        <div className="main-content">
          <Routes>
            {/* Your existing routes */}
          </Routes>
        </div>
      </Router>
    </div>
  );
};