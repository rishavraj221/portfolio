// vite-react-ssg's flat dirStyle always appends ".html" to a route's path,
// with no check for whether the path already ends in ".html" — so routes
// defined with a literal ".html" (needed so the client router matches the
// URL after hydration) get written as "*.html.html". Rename them back.
import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve(import.meta.dirname, "../dist");

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name.endsWith(".html.html")) {
      const fixed = full.slice(0, -".html".length);
      fs.renameSync(full, fixed);
      console.log("fixed", path.relative(DIST, full), "->", path.relative(DIST, fixed));
    }
  }
}

walk(DIST);
