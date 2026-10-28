// Smart clipboard: recent copies, with an action that fits what was copied.
Island.register({
  id: "clipboard",
  icon: ICONS.clip,
  items: [],
  flash: 0,

  init() {
    this.list = h("div", { class: "cl-list stagger scroll clipboard-history" });
    this.title = h("div", { class: "p-title" }, t("clipboard"));
    this.clearBtn = h(
      "button",
      { class: "chip", onclick: () => API.call("clipboard:clear") },
      t("clear"),
    );
    this.empty = h(
      "div",
      { class: "p-empty" },
      h("div", { class: "m-title lg" }, t("clipEmpty")),
      h("div", { class: "m-artist" }, t("clipEmptySub")),
    );
    this.expandedEl = h(
      "div",
      { class: "view auto panel" },
      h("div", { class: "p-head" }, this.title, this.clearBtn),
      this.list,
      this.empty,
    );

    API.on("clipboard:update", (items) => this.set(items));
    API.call("clipboard:list").then((items) => items && this.set(items));
    this.paint();
  },

  set(items) {
    this.items = items || [];
    this.paint();
    Island.render();
  },

  kindIcon(item) {
    const dot = (cls, content, style) =>
      h("span", { class: "k " + cls, style }, content);
    if (item.type === "image")
      return h("img", {
        class: "clip-preview",
        src: item.data,
        alt: "صورة / Image",
      });
    if (item.type === "color")
      return dot("color", "", `background:${item.color}`);
    if (item.type === "url") return dot("url", "↗");
    if (item.type === "email") return dot("email", "@");
    if (item.type === "phone") return dot("phone", "✆");
    if (item.type === "math") return dot("math", "=");
    return dot("text", "T");
  },

  action(item) {
    const chip = (label, fn) =>
      h(
        "button",
        {
          class: "chip act",
          "data-interactive": "1",
          onclick: (e) => {
            e.stopPropagation();
            fn();
          },
        },
        label,
      );
    switch (item.type) {
      case "image":
        return null;
      case "address":
        return chip(LANG === "ar" ? "خريطة" : "Map", () =>
          API.send(
            "open:external",
            "https://www.openstreetmap.org/search?query=" +
              encodeURIComponent(item.text),
          ),
        );
      case "url":
        return chip(t("open"), () =>
          API.send("open:external", item.text.trim()),
        );
      case "email":
        return chip(t("mailto"), () =>
          API.send("open:external", "mailto:" + item.text.trim()),
        );
      case "phone":
        return h(
          "div",
          { class: "chips" },
          chip(LANG === "ar" ? "اتصال" : "Call", () =>
            API.send("open:external", "tel:" + item.digits),
          ),
          chip(t("whatsapp"), () =>
            API.send(
              "open:external",
              "https://wa.me/" +
                item.digits.replace(/^\+/, "").replace(/^00/, ""),
            ),
          ),
        );
      case "color":
        return chip(t("copyRgb"), () => this.copy(item, "rgb"));
      case "math":
        return chip("= " + item.result, () => this.copy(item, "result"));
      default: {
        // plain text: translate (Arabic -> English, anything else -> Arabic)
        const text = item.text.trim().slice(0, 1500);
        if (!text || text.length < 2) return null;
        const to = /[\u0600-\u06ff]/.test(text) ? "en" : "ar";
        return chip(t("translate"), () =>
          API.call("text:translate", text, to).then((r) => {
            Island.feature("assistant").show(r.text || r.error);
            Island.open("assistant");
          }),
        );
      }
    }
  },

  copy(item, as, row) {
    API.call("clipboard:copy", item.id, as);
    if (row) {
      row.classList.add("copied");
      setTimeout(() => row.classList.remove("copied"), 900);
    }
  },

  paint() {
    const shown = this.items.slice(0, 20);
    this.empty.style.display = shown.length ? "none" : "";
    this.list.style.display = shown.length ? "" : "none";
    this.clearBtn.style.display = this.items.some((i) => !i.pinned)
      ? ""
      : "none";
    this.list.replaceChildren(
      ...shown.map((item) => {
        const row = h(
          "div",
          {
            class: "cl-row" + (item.pinned ? " pinned" : ""),
            onclick: () => this.copy(item, undefined, row),
          },
          this.kindIcon(item),
          h(
            "span",
            { class: "cl-text", dir: "auto" },
            item.text.replace(/\s+/g, " ").trim().slice(0, 120),
          ),
          this.action(item),
          h(
            "button",
            {
              class: "chip",
              "data-interactive": "1",
              onclick: async (e) => {
                e.stopPropagation();
                const pasted = await API.call("clipboard:paste", item.id);
                if (!pasted)
                  Notice.show({
                    text:
                      LANG === "ar"
                        ? "نُسخ العنصر؛ الصقه في التطبيق المطلوب"
                        : "Copied; paste into the destination app",
                  });
              },
            },
            LANG === "ar" ? "لصق" : "Paste",
          ),
          h(
            "button",
            {
              class: "icon-btn pin" + (item.pinned ? " on" : ""),
              title: t("pin"),
              "data-interactive": "1",
              onclick: (e) => {
                e.stopPropagation();
                API.call("clipboard:pin", item.id);
              },
            },
            html(ICONS.star),
          ),
          h("span", { class: "copied-flag" }, t("copied")),
        );
        return row;
      }),
    );
  },

  priority: () => 0,

  view(mode) {
    if (mode !== "expanded") return null;
    return { el: this.expandedEl, w: 480, auto: true };
  },
});
