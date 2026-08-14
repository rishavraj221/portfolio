import type { RouteRecord } from "vite-react-ssg";
import { Outlet } from "react-router-dom";

function Layout() {
  return <Outlet />;
}

export const routes: RouteRecord[] = [
  {
    path: "/",
    element: <Layout />,
    entry: "src/App.tsx",
    children: [
      { index: true, lazy: () => import("./pages/Home") },
      // Routes keep the literal ".html" that appears in the browser's address
      // bar (matching the URLs this site has always had), even though that
      // means a postbuild step has to undo the double ".html.html" this
      // tool's flat dirStyle would otherwise write — see scripts/fix-html-ext.mjs.
      { path: "projects/knowledge-assistant.html", lazy: () => import("./pages/projects/KnowledgeAssistant") },
      { path: "projects/rbac.html", lazy: () => import("./pages/projects/Rbac") },
      { path: "projects/fastail.html", lazy: () => import("./pages/projects/Fastail") },
      { path: "projects/kureita.html", lazy: () => import("./pages/projects/Kureita") },
      { path: "system-design/", lazy: () => import("./pages/system-design/Index") },
      { path: "system-design/chat-application.html", lazy: () => import("./pages/system-design/ChatApplication") },
      { path: "system-design/chat-demo-log.html", lazy: () => import("./pages/system-design/ChatDemoLog") },
    ],
  },
];
