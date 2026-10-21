import { mount } from "svelte";
import App from "./App.svelte";
import "./focus.css";

mount(App, { target: document.getElementById("app")! });
