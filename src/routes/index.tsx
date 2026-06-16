import { createFileRoute } from "@tanstack/react-router";
import { AppProvider } from "@/lib/app-context";
import { AppRoot } from "@/components/AppRoot";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VaultRecord — Private Meeting Assistant" },
      { name: "description", content: "100% local, private meeting assistant. Record, transcribe and generate meeting protocols with AI — all data stays on your device." },
      { property: "og:title", content: "VaultRecord — Private Meeting Assistant" },
      { property: "og:description", content: "100% local, private meeting assistant. Your data never leaves your device." },
    ],
  }),
  ssr: false,
  component: Index,
});

function Index() {
  return (
    <AppProvider>
      <AppRoot />
    </AppProvider>
  );
}
