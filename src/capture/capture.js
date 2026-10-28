const api = window.captureAPI,
  $ = (id) => document.getElementById(id),
  canvas = $("canvas"),
  ctx = canvas.getContext("2d");
let image = null,
  selection = null,
  drag = null,
  mode = "image",
  recorder = null,
  stream = null,
  saveChain = Promise.resolve(),
  stopTimer = null;
const status = (text) => ($("status").textContent = text);
function paint() {
  if (!image) return;
  ctx.drawImage(image, 0, 0);
  if (selection) {
    ctx.strokeStyle = "#b89aff";
    ctx.lineWidth = Math.max(2, canvas.width / 500);
    ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);
  }
}
const point = (e) => ({
  x: Math.max(
    0,
    Math.min(
      canvas.width,
      ((e.clientX - canvas.getBoundingClientRect().left) * canvas.width) /
        canvas.clientWidth,
    ),
  ),
  y: Math.max(
    0,
    Math.min(
      canvas.height,
      ((e.clientY - canvas.getBoundingClientRect().top) * canvas.height) /
        canvas.clientHeight,
    ),
  ),
});
canvas.addEventListener("pointerdown", (e) => {
  drag = point(e);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const p = point(e);
  selection = {
    x: Math.min(p.x, drag.x),
    y: Math.min(p.y, drag.y),
    width: Math.abs(p.x - drag.x),
    height: Math.abs(p.y - drag.y),
  };
  paint();
});
canvas.addEventListener("pointerup", () => (drag = null));
async function crop(ocr) {
  if (!selection) return status("حدّد منطقة أولًا / Select a region first");
  status("جارٍ العمل… / Working…");
  try {
    const r = await api.call("capture:crop", selection, ocr);
    status(r.ok ? r.text || r.path : r.error);
  } catch (e) {
    status(e.message);
  }
}
$("save").onclick = () => crop(false);
$("ocr").onclick = () => crop(true);
$("record").onclick = async () => {
  try {
    if (!image) return status("اختر الشاشة / Select a display");
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 15 },
      audio: false,
    });
    $("video").srcObject = stream;
    $("video").style.display = "block";
    canvas.hidden = true;
    recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8",
      videoBitsPerSecond: 1500000,
    });
    saveChain = Promise.resolve();
    recorder.ondataavailable = (e) => {
      if (e.data.size)
        saveChain = saveChain
          .then(async () =>
            api.call("capture:chunk", await e.data.arrayBuffer()),
          )
          .catch((err) => {
            status(err.message);
            stop();
          });
    };
    recorder.onstop = async () => {
      clearTimeout(stopTimer);
      stream.getTracks().forEach((t) => t.stop());
      await saveChain;
      const r = await api.call("capture:finish");
      status(r.path || "لم يُحفظ التسجيل / Recording not saved");
      $("record").disabled = false;
    };
    stream.getVideoTracks()[0].onended = stop;
    recorder.start(1000);
    $("record").disabled = true;
    status("جارٍ تسجيل الشاشة المختارة / Recording selected screen");
    stopTimer = setTimeout(stop, 60000);
  } catch (e) {
    status(e.message);
    stream?.getTracks().forEach((t) => t.stop());
  }
};
function stop() {
  if (recorder && recorder.state === "recording") recorder.stop();
}
$("stop").onclick = stop;
window.addEventListener("beforeunload", () => {
  clearTimeout(stopTimer);
  stream?.getTracks().forEach((t) => t.stop());
});
(async () => {
  mode = await api.call("capture:mode");
  $("record").hidden = $("stop").hidden = mode !== "record";
  $("save").hidden = $("ocr").hidden = mode === "record";
  const sources = await api.call("capture:list");
  $("sources").replaceChildren(
    ...sources.map((s) => {
      const b = document.createElement("button");
      const img = document.createElement("img");
      img.src = s.thumb;
      img.alt = s.name;
      b.append(img, document.createTextNode(s.name));
      b.onclick = async () => {
        if (recorder && recorder.state === "recording") return;
        const data = await api.call("capture:select", s.id);
        image = new Image();
        image.onload = () => {
          canvas.width = image.width;
          canvas.height = image.height;
          selection = { x: 0, y: 0, width: image.width, height: image.height };
          paint();
        };
        image.src = data;
      };
      return b;
    }),
  );
})().catch((e) => status(e.message));
