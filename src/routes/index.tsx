import { createFileRoute } from "@tanstack/react-router";
import { AppProvider } from "@/lib/app-context";
import { AppRoot } from "@/components/AppRoot";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VaultRecord — עוזר ישיבות פרטי" },
      { name: "description", content: "עוזר ישיבות מקומי ופרטי. הקלטה, תמלול ופרוטוקול — הכל נשמר רק במכשיר שלך." },
      { property: "og:title", content: "VaultRecord — עוזר ישיבות פרטי" },
      { property: "og:description", content: "עוזר ישיבות מקומי לחלוטין. הנתונים שלך לא עוזבים את המכשיר." },
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
