import { o as ThemeProvider, t as ThemeSwitcher } from "./ThemeSwitcher-02E8cdLF.js";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
//#region src/auto.js
var root = null;
var container = null;
var pending = null;
/**
* Mounts the colour button and panel on its own, outside the site's app. Calling it again
* replaces the previous mount with the new config. Returns a function that removes it.
* @param {import('./ThemeProvider.jsx').ColorsByMaxConfig} [config]
*/
function autoMount(config = {}) {
	cancelPending();
	unmount();
	container = document.createElement("div");
	container.dataset.colorsbymax = "auto";
	document.body.append(container);
	root = createRoot(container);
	root.render(createElement(ThemeProvider, { config }, createElement(ThemeSwitcher)));
	return unmount;
}
function unmount() {
	root?.unmount();
	container?.remove();
	root = container = null;
}
function cancelPending() {
	if (pending) pending();
	pending = null;
}
var MOUNT_DELAY = 50;
if (typeof window !== "undefined") {
	let timer = 0;
	const onLoad = () => {
		timer = setTimeout(() => {
			if (!root) autoMount();
		}, MOUNT_DELAY);
	};
	pending = () => {
		clearTimeout(timer);
		window.removeEventListener("load", onLoad);
	};
	if (document.readyState === "complete") onLoad();
	else window.addEventListener("load", onLoad);
}
//#endregion
export { autoMount };
