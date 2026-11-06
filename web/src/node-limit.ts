import { mount } from "svelte";
import NodeLimit from "./NodeLimit.svelte";
import "./tokens.css";
import "./focus.css";

mount(NodeLimit, { target: document.getElementById("app")! });
