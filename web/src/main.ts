import { mount } from "svelte";
import App from "./App.svelte";
import "./focus.css";
import "./screen.svelte"; // sets the page root's screen flags before the first draw

mount(App, { target: document.getElementById("app")! });
