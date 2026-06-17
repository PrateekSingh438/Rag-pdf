// Branded link-preview image (Open Graph / Twitter), generated at build/request
// time so sharing the URL on LinkedIn/Slack/etc. shows a proper card instead of a
// bare link. Next wires this file into the page metadata automatically.
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "StudyMate — AI study companion";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #e11d48 0%, #f97316 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 4,
            fontWeight: 600,
            color: "#ffe4e6",
            textTransform: "uppercase",
          }}
        >
          AI Study Companion
        </div>
        <div style={{ display: "flex", fontSize: 130, fontWeight: 800, marginTop: 8 }}>
          StudyMate
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 40,
            color: "#fed7aa",
            marginTop: 16,
            maxWidth: 900,
            textAlign: "center",
          }}
        >
          Answers grounded in your own notes — with citations.
        </div>
      </div>
    ),
    { ...size },
  );
}
