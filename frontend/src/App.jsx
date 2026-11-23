import React, { useState } from 'react';
import { SambaProvider, useSamba } from './context/SambaContext';
import { MobileShell } from './components/layout/MobileShell';
import { BottomNav } from './components/layout/BottomNav';
import { SambaChatDrawer } from './components/chat/SambaChatDrawer';
import { ProfileDrawer } from './components/profile/ProfileDrawer';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { Step1Name } from './pages/onboarding/Step1Name';
import { Step2Goal } from './pages/onboarding/Step2Goal';
import { Step3Physical } from './pages/onboarding/Step3Physical';
import { Step4Activity } from './pages/onboarding/Step4Activity';
import { Step5Allergies } from './pages/onboarding/Step5Allergies';
import { CreateAccountPage } from './pages/CreateAccountPage';
import { DashboardPage } from './pages/DashboardPage';
import { MealsPage } from './pages/MealsPage';
import { WorkoutsPage } from './pages/WorkoutsPage';

function SambaRouter() {
  const { screen, activeTab, loadingSession } = useSamba();
  const [profileRefreshTick, setProfileRefreshTick] = useState(0);

  if (loadingSession) {
    return (
      <MobileShell variant="mesh" className="items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[#006c49]">
          <span className="material-symbols-outlined text-[32px] animate-spin">
            progress_activity
          </span>
          <span className="text-[14px] font-bold">Cargando Samba...</span>
        </div>
      </MobileShell>
    );
  }

  if (screen === 'welcome') return <WelcomePage />;
  if (screen === 'login') return <LoginPage />;
  if (screen === 'onboarding-1') return <Step1Name />;
  if (screen === 'onboarding-2') return <Step2Goal />;
  if (screen === 'onboarding-3') return <Step3Physical />;
  if (screen === 'onboarding-4') return <Step4Activity />;
  if (screen === 'onboarding-5') return <Step5Allergies />;
  if (screen === 'create-account') return <CreateAccountPage />;

  return (
    <MobileShell variant="app" className="justify-start">
      {activeTab === 'inicio' && <DashboardPage />}
      {activeTab === 'platillo' && <MealsPage refreshTrigger={profileRefreshTick} />}
      {activeTab === 'entreno' && <WorkoutsPage refreshTrigger={profileRefreshTick} />}
      <BottomNav />
      <SambaChatDrawer />
      <ProfileDrawer onProfileUpdated={() => setProfileRefreshTick((n) => n + 1)} />
    </MobileShell>
  );
}

export default function App() {
  return (
    <SambaProvider>
      <SambaRouter />
    </SambaProvider>
  );
}
