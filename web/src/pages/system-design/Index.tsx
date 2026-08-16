import Seo from "../../components/Seo";

export function Component() {
  return (
    <>
      <Seo
        title="System Design | Rishav Raj"
        description="System design walkthroughs, written as a company building a real system one decision at a time."
        canonical="https://rishavraj.info/system-design/"
        ogType="website"
      />
      <div className="wrap page">
        <a className="back" href="../index.html">
          Rishav Raj
        </a>

        <h1 className="title">System design</h1>
        <p className="standfirst">
          Each of these walks through a system end to end, told as a company hitting the
          problem for real and making a decision at each step. Where there are numbers I
          have used real ones and linked the source.
        </p>

        <hr />

        <h2>Notes</h2>
        <ul className="list">
          <li>
            <a href="chat-application.html">Designing a chat application</a>
            <span className="note">
              Delivery guarantees, fanout for group chats, presence, and why WhatsApp moved
              off a thread per connection.
            </span>
          </li>
          <li>
            <a href="media-service.html">Designing a media service</a>
            <span className="note">
              Presigned uploads, thumbnail generation without a queue service, and why file
              storage is a separate service from the chat app that uses it.
            </span>
          </li>
          <li>
            <a href="rbac-service.html">Designing a multi-tenant RBAC service</a>
            <span className="note">
              Roles, permissions, local vs. central authorization, policy-version revocation,
              and a working demo with production-shaped Terraform.
            </span>
          </li>
        </ul>

        <p className="muted small">More coming as I work through them.</p>

        <hr />

        <p className="small">
          <a href="../index.html">Back to home</a>
        </p>

        <footer>
          <p>
            <a href="mailto:rairishav221@gmail.com">rairishav221@gmail.com</a>
          </p>
        </footer>
      </div>
    </>
  );
}
