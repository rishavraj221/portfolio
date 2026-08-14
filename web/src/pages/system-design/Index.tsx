// Migrated from system-design/index.html by scripts/migrate.mjs — content is the
// original hand-authored markup (including inline SVG figures), rendered
// as-is. Head metadata is now managed by <Seo/> so it's baked into the
// static HTML at build time via vite-react-ssg.
// Named "Component" (not a default export) because vite-react-ssg's
// route.lazy() expects that exact export name.
import Seo from "../../components/Seo";

export function Component() {
  return (
    <>
      <Seo
        title={"System Design | Rishav Raj"}
        description={"System design walkthroughs, written as a company building a real system one decision at a time."}
        canonical={"https://rishavraj.info/system-design/"}
        ogType={"website"}
      />
      <div className="wrap page" dangerouslySetInnerHTML={{ __html: "<a class=\"back\" href=\"../index.html\">Rishav Raj</a>\n\n  <h1 class=\"title\">System design</h1>\n  <p class=\"standfirst\">\n    Each of these walks through a system end to end, told as a company hitting the\n    problem for real and making a decision at each step. Where there are numbers I have\n    used real ones and linked the source.\n  </p>\n\n  <hr>\n\n  <h2>Notes</h2>\n  <ul class=\"list\">\n    <li>\n      <a href=\"chat-application.html\">Designing a chat application</a>\n      <span class=\"note\">Delivery guarantees, fanout for group chats, presence, and why WhatsApp moved off a thread per connection.</span>\n    </li>\n  </ul>\n\n  <p class=\"muted small\">\n    More coming as I work through them.\n  </p>\n\n  <hr>\n\n  <p class=\"small\">\n    <a href=\"../index.html\">Back to home</a>\n  </p>\n\n  <footer>\n    <p><a href=\"mailto:rairishav221@gmail.com\">rairishav221@gmail.com</a></p>\n  </footer>" }} />
    </>
  );
}
