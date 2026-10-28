// No require(), network, files, or system access; publish text only.
function tick() {
  islandPlugin.publish({
    title: "Clock",
    text: new Date().toLocaleTimeString(),
  });
}
tick();
setInterval(tick, 1000);
