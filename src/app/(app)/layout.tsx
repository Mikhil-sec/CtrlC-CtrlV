import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { PlanProvider } from "@/lib/store/plan-store";
import { ScenarioBridgeProvider } from "@/lib/store/sandbox-scenario";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlanProvider>
      <ScenarioBridgeProvider>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
            {children}
          </main>
          <Footer />
        </div>
      </ScenarioBridgeProvider>
    </PlanProvider>
  );
}
