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
      //
      // "index.html" is registered explicitly in addition to `index: true`
      // above: `index: true` only matches the bare "/", so a direct load or
      // refresh of "/index.html" (a real URL — every subpage links back to
      // "index.html"/"../index.html") found no client-side route match post-
      // hydration, mismatched the server-rendered HTML, and crashed with a
      // React hydration error. Same reasoning applies to
      // "system-design/index.html" below.
      { path: "index.html", lazy: () => import("./pages/Home") },
      { path: "projects/knowledge-assistant.html", lazy: () => import("./pages/projects/KnowledgeAssistant") },
      { path: "projects/rbac.html", lazy: () => import("./pages/projects/Rbac") },
      { path: "projects/fastail.html", lazy: () => import("./pages/projects/Fastail") },
      { path: "projects/kureita.html", lazy: () => import("./pages/projects/Kureita") },
      { path: "system-design/", lazy: () => import("./pages/system-design/Index") },
      { path: "system-design/index.html", lazy: () => import("./pages/system-design/Index") },
      { path: "system-design/chat-application.html", lazy: () => import("./pages/system-design/ChatApplication") },
      { path: "system-design/media-service.html", lazy: () => import("./pages/system-design/MediaService") },
    ],
  },
];
