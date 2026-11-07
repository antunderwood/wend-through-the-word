import { mount } from "svelte";
import App from "./App.svelte";
import "./tokens.css";
import "./focus.css";
import "./screen.svelte"; // sets the page root's screen flags before the first draw

mount(App, { target: document.getElementById("app")! });

// The service worker makes the site installable as an app (decision 228). Only the staged site
// registers it, so the e2e build and dev never run one.
if (import.meta.env.MODE === "site" && "serviceWorker" in navigator) {
  addEventListener("load", () => void navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
