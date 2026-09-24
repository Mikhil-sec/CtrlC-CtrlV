import { auth } from "@/auth";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { PlanErrorBanner } from "@/components/shell/error-banner";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import { OnboardingProvider } from "@/lib/store/onboarding";
import { PlanProvider } from "@/lib/store/plan-store";
import { ScenarioBridgeProvider } from "@/lib/store/sandbox-scenario";
import { SessionProvider, type AppSession } from "@/lib/store/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const appSession: AppSession = {
    signedIn: Boolean(session?.user?.id),
    userId: session?.user?.id ?? null,
    userName: session?.user?.name ?? null,
    userImage: session?.user?.image ?? null,
  };

  return (
    <SessionProvider value={appSession}>
      <PlanProvider>
        <ScenarioBridgeProvider>
          <OnboardingProvider>
            <div className="flex min-h-screen flex-col">
              <Header
                user={
                  appSession.signedIn
                    ? { name: appSession.userName, image: appSession.userImage }
                    : null
                }
              />
              <PlanErrorBanner />
              <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
                {children}
              </main>
              <Footer />
            </div>
            <OnboardingModal />
          </OnboardingProvider>
        </ScenarioBridgeProvider>
      </PlanProvider>
    </SessionProvider>
  );
}
