// One-off migration script: extracts head metadata + body content from the
// existing static HTML pages and writes React page components that render
// the same markup, so the visual output is byte-for-byte identical while
// routing/head management becomes real React (via vite-react-ssg's <Head/>).
// Not part of the app build — run manually, then delete or leave as a record.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.resolve(import.meta.dirname, "../src/pages");

function extract(re, html, group = 1) {
  const m = html.match(re);
  return m ? m[group].trim() : "";
}

function migrate(srcRelPath, outFile) {
  const html = fs.readFileSync(path.join(ROOT, srcRelPath), "utf-8");

  const title = extract(/<title>(.*?)<\/title>/s, html);
  const description = extract(/<meta name="description" content="(.*?)">/s, html);
  const canonical = extract(/<link rel="canonical" href="(.*?)">/s, html);
  const ogType = extract(/<meta property="og:type" content="(.*?)">/s, html) || "website";
  const jsonLd = extract(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/, html);

  const bodyMatch = html.match(/<div class="wrap page">([\s\S]*?)\n<\/div>\n\n<\/body>/);
  if (!bodyMatch) throw new Error(`Could not find .wrap.page body in ${srcRelPath}`);
  const body = bodyMatch[1].trim();

  const jsonLdProp = jsonLd
    ? `\n      jsonLd={${JSON.stringify(JSON.parse(jsonLd))}}`
    : "";

  const depth = outFile.split("/").length - 1;
  const seoImportPath = `${"../".repeat(depth + 1)}components/Seo`;

  const out = `// Migrated from ${srcRelPath} by scripts/migrate.mjs — content is the
// original hand-authored markup (including inline SVG figures), rendered
// as-is. Head metadata is now managed by <Seo/> so it's baked into the
// static HTML at build time via vite-react-ssg.
// Named "Component" (not a default export) because vite-react-ssg's
// route.lazy() expects that exact export name.
import Seo from "${seoImportPath}";

export function Component() {
  return (
    <>
      <Seo
        title={${JSON.stringify(title)}}
        description={${JSON.stringify(description)}}
        canonical={${JSON.stringify(canonical)}}
        ogType={${JSON.stringify(ogType)}}${jsonLdProp}
      />
      <div className="wrap page" dangerouslySetInnerHTML={{ __html: ${JSON.stringify(body)} }} />
    </>
  );
}
`;

  fs.mkdirSync(path.dirname(path.join(OUT, outFile)), { recursive: true });
  fs.writeFileSync(path.join(OUT, outFile), out);
  console.log("wrote", outFile);
}

migrate("index.html", "Home.tsx");
migrate("projects/knowledge-assistant.html", "projects/KnowledgeAssistant.tsx");
migrate("projects/rbac.html", "projects/Rbac.tsx");
migrate("projects/fastail.html", "projects/Fastail.tsx");
migrate("projects/kureita.html", "projects/Kureita.tsx");
migrate("system-design/index.html", "system-design/Index.tsx");
migrate("system-design/chat-application.html", "system-design/ChatApplication.tsx");
migrate("system-design/rbac-service.html", "system-design/RbacService.tsx");
