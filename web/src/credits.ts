import { mount } from "svelte";
import Credits from "./Credits.svelte";
import "./focus.css";
import "./page.css";

mount(Credits, { target: document.getElementById("app")! });
