import { Outlet } from 'react-router-dom';
import { ThemeProvider } from './core/theme/ThemeContext';
import { Sidebar } from './core/components/Sidebar/Sidebar';
import { Topbar } from './core/components/Topbar/Topbar';
import styles from './App.module.css';

function App() {
  return (
    <ThemeProvider>
      <div className={styles.appContainer}>
        <Sidebar />
        <div className={styles.mainWrapper}>
          <Topbar />
          <main className={styles.mainContent}>
            <Outlet />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
