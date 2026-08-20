import Seo from "../../components/Seo";

export function Component() {
  return (
    <>
      <Seo
        title="Products | Rishav Raj"
        description="Things I've built and shipped, not just written up."
        canonical="https://rishavraj.info/products/"
        ogType="website"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Products",
          url: "https://rishavraj.info/products/",
          author: { "@type": "Person", name: "Rishav Raj", url: "https://rishavraj.info/" },
          mainEntity: {
            "@type": "ItemList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                item: {
                  "@type": "SoftwareApplication",
                  name: "infraviz",
                  url: "https://rishavraj.info/products/infraviz/",
                  applicationCategory: "DeveloperApplication",
                  description:
                    "Architecture docs that cite their sources — every claim carries an exact substring from a real file.",
                },
              },
            ],
          },
        }}
      />
      <div className="wrap page">
        <a className="back" href="../index.html">
          Rishav Raj
        </a>

        <h1 className="title">Products</h1>
        <p className="standfirst">
          Things I have built and shipped, rather than just written up.
        </p>

        <hr />

        <ul className="list">
          <li>
            <a href="infraviz/">infraviz</a>
            <span className="note">
              Architecture docs that cite their sources — every claim carries an exact
              substring from a real file, and one command re-reads your source to prove
              it still holds.
            </span>
          </li>
        </ul>

        <p className="muted small">More as I ship them.</p>

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
