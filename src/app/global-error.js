"use client";

// Last resort when even the site's frame (header, fonts) can't load, e.g.
// the database is down. It has to bring its own <html> and styles.
export default function GlobalError({ reset }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeContent: "center",
          padding: 16,
          textAlign: "center",
          background: "#070a15",
          color: "#f2ede4",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 32, margin: 0 }}>Something went wrong</h1>
        <p style={{ opacity: 0.7, marginTop: 12 }}>The site didn’t load. It’s usually back in a few seconds.</p>
        <p style={{ marginTop: 24 }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              height: 44,
              padding: "0 24px",
              border: 0,
              borderRadius: 999,
              background: "#e7cb98",
              color: "#070a15",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </p>
      </body>
    </html>
  );
}
