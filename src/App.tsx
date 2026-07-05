import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './core/components/Sidebar/Sidebar';
import { Topbar } from './core/components/Topbar/Topbar';
import styles from './App.module.css';

function App() {
  // ≤900px: sidebar çekmeceye dönüşür; Topbar'daki hamburger açar, overlay/rota kapatır.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.appContainer}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={styles.mainWrapper}>
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className={styles.mainContent}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default App;
