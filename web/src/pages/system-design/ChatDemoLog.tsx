import Seo from "../../components/Seo";

export function Component() {
  return (
    <>
      <Seo
        title="Building the Chat Demo | Rishav Raj"
        description="The build log for Wavelink, a working chat app built from the system design write-up: registration, delivery ticks, presence, multi-device sync, and notifications, phase by phase."
        canonical="https://rishavraj.info/system-design/chat-demo-log.html"
        ogType="article"
      />
      <div className="wrap page">
        <a className="back" href="index.html">
          System design
        </a>

        <h1 className="title">Building the chat demo</h1>
        <p className="standfirst">
          The write-up above is the design. This is the build log: actually standing up
          Wavelink, phase by phase, bugs included.
        </p>

        <div className="rows small">
          <div className="row">
            <div className="k">Topic</div>
            <div className="v">System design</div>
          </div>
          <div className="row">
            <div className="k">Status</div>
            <div className="v">In progress</div>
          </div>
        </div>

        <hr />

        <h2>Register first, not "type anything"</h2>
        <p>
          No password, just a name. But that name is real now: claim it once, and coming
          back later with the same one resumes the same inbox instead of erroring out or
          starting over. Two tabs, two names, is the whole test of "a phone and a laptop."
        </p>

        <h2>The core loop</h2>
        <p>
          A message gets written to the recipient's queue first, then pushed if they're
          connected. That's the offline-delivery design from the write-up above, actually
          running. Close a tab mid-conversation, reopen it, the messages are exactly where
          you left them.
        </p>

        <h2>Three ticks, honestly earned</h2>
        <p>
          Sent, delivered, read, each one its own event, not a guess. Getting "delivered"
          right took a real bug first: the status <code>:delivered</code> did not exist as
          an Erlang atom until the moment two people actually messaged each other, and the
          channel crashed the first time anyone tried. Fixed, and now tested for it.
        </p>

        <h2>Read means what it says</h2>
        <p>
          An earlier version marked a message "read" the moment it arrived, whether anyone
          was looking or not. It only flips green now when that specific conversation is
          the thing actually open on screen, closing the gap between what the tick claims
          and what a person did.
        </p>

        <h2>Presence, for real</h2>
        <p>
          Online and offline dots come from Phoenix Presence, not a fake timer. Open the
          same username in two tabs and both agree on who's around, updating live,
          including the moment either one disconnects.
        </p>

        <h2>The same person, twice</h2>
        <p>
          Signing in as the same user on two tabs used to mean they didn't know about each
          other: a message sent from one never showed up on the other. Every send now also
          reaches your own other devices, the same idea as WhatsApp Web staying in sync
          with your phone.
        </p>

        <h2>Getting your attention</h2>
        <p>
          Two layers, on purpose. A real browser notification when a chat isn't the thing
          on screen, and a Notifications page inside the app for everything missed while
          the tab was closed, because a push can always get lost and a durable list can't.
        </p>

        <h2>What's next</h2>
        <p>
          It still looks and feels like a demo, not a product, so that's first. After that:
          group chats, media messages, real end-to-end encryption, access control, and
          actually deploying this instead of running it on a laptop.
        </p>

        <hr />

        <p className="small">
          <a href="chat-application.html">The design write-up</a> &middot;{" "}
          <a href="index.html">All system design notes</a> &middot; <a href="../index.html">Home</a>
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
