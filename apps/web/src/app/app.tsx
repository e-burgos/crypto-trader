import { Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../components/theme-provider';
import { Navbar } from '../components/navbar';
import { PriceTicker } from '../components/price-ticker';
import { LandingPage } from '../pages/landing';

export function App() {
  return (
    <ThemeProvider>
      <Navbar />
      <PriceTicker />
      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </main>
    </ThemeProvider>
  );
}

export default App;

