import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { SetupScreen, LockScreen } from "@/components/AuthScreens";
import { Dashboard } from "@/components/Dashboard";
import { MeetingView } from "@/components/MeetingView";
import { SettingsView } from "@/components/SettingsView";
import { Toaster } from "@/components/ui/sonner";
import { registerServiceWorker } from "@/lib/pwa";

type View =
  | { kind: "dashboard" }
  | { kind: "meeting"; id: string | "new" }
  | { kind: "settings" };

export function AppRoot() {
  const { ready, initialized, unlocked } = useApp();
  const [view, setView] = useState<View>({ kind: "dashboard" });

  useEffect(() => {
    registerServiceWorker();
  }, []);

  if (!ready) {
    return <div className="min-h-dvh grid place-items-center text-muted-foreground">…</div>;
  }
  if (!initialized) return <><SetupScreen /><Toaster /></>;
  if (!unlocked) return <><LockScreen /><Toaster /></>;

  return (
    <>
      {view.kind === "dashboard" && (
        <Dashboard
          onOpenMeeting={(id) => setView({ kind: "meeting", id })}
          onOpenSettings={() => setView({ kind: "settings" })}
        />
      )}
      {view.kind === "meeting" && (
        <MeetingView meetingId={view.id} onClose={() => setView({ kind: "dashboard" })} />
      )}
      {view.kind === "settings" && (
        <SettingsView onClose={() => setView({ kind: "dashboard" })} />
      )}
      <Toaster position="top-center" />
    </>
  );
}
