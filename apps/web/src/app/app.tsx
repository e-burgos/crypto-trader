import { Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../components/theme-provider';
import { Navbar } from '../components/navbar';
import { PriceTicker } from '../components/price-ticker';
import { ProtectedRoute } from '../components/protected-route';
import { LandingPage } from '../pages/landing';
import { LoginPage } from '../pages/login';
import { RegisterPage } from '../pages/register';
import { OnboardingPage } from '../pages/onboarding';

function DashboardPlaceholder() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Coming soon — Spec 09</p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <Navbar />
      <PriceTicker />
      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/onboarding" element={
            <ProtectedRoute><OnboardingPage /></ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardPlaceholder /></ProtectedRoute>
          } />
        </Routes>
      </main>
    </ThemeProvider>
  );
}

export default App;


