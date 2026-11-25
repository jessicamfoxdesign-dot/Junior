import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Sign-in only returns to the https address, so never run on plain http.
if (location.protocol === "http:" && location.hostname !== "localhost") {
  location.replace(`https://${location.host}${location.pathname}${location.search}${location.hash}`);
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
