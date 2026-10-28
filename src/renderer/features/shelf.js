// File shelf: a temporary holding area. Add by dropping files, or select them in Explorer and press Ctrl+Alt+S.
// Drag items back out to any app. The files themselves are never copied or moved.
Island.register({
  id: 'shelf',
  icon: ICONS.shelf,
  items: [],
  selected: new Set(),
  notice: '',

  init() {
    this.title = h('div', { class: 'p-title' }, t('shelf'));
    this.count = h('span', { class: 'count' });
    this.clearBtn = h('button', { class: 'chip', onclick: () => this.clear() }, t('clearAll'));
    this.strip = h('div', { class: 'sh-strip scroll stagger' });
    this.empty = h('div', { class: 'sh-empty' }, h('div', { class: 'm-title lg' }, t('shelfEmpty')), h('div', { class: 'm-artist' }, t('shelfEmptySub')));
    this.expandedEl = h(
      'div',
      { class: 'view auto panel shelf' },
      h('div', { class: 'p-head' }, h('div', { class: 'p-title-wrap' }, this.title, this.count), this.clearBtn),
      h(
        'div',
        { class: 'chips' },
        h('button', { class: 'chip', onclick: () => this.processSelected('pdf-merge') }, LANG === 'ar' ? 'دمج PDF المحددة' : 'Merge selected PDFs'),
        h('button', { class: 'chip', onclick: () => API.call('files:stop-share') }, LANG === 'ar' ? 'إيقاف المشاركة' : 'Stop sharing')
      ),
      this.strip,
      this.empty
    );

    this.peekText = h('div', { class: 'm-title' });
    this.peekEl = h('div', { class: 'view notice-view' }, h('span', { class: 'n-icon' }, html(ICONS.shelf)), h('div', { class: 'm-text' }, this.peekText));

    API.on('shelf:update', (items) => this.set(items));
    API.on('shelf:added', ({ count, selected }) => {
      this.peekText.textContent = count ? t('shelfAdded', { n: num(count) }) : selected ? t('shelfAlready') : t('shelfNothing');
      Island.peek('shelf', 2600);
    });
    API.call('shelf:list').then((items) => items && this.set(items));
    this.paint();
  },

  set(items) {
    this.items = items || [];
    const ids = new Set(this.items.map((i) => i.id));
    this.selected = new Set([...this.selected].filter((id) => ids.has(id)));
    this.paint();
    Island.render();
  },

  clear() {
    this.selected.clear();
    API.call('shelf:clear');
  },

  /** Called by app.js when files are dropped on the island. */
  async drop(files) {
    const paths = API.pathsForFiles(files);
    if (paths.length) await API.call('shelf:add', paths);
  },

  paint() {
    const has = this.items.length > 0;
    this.empty.style.display = has ? 'none' : '';
    this.strip.style.display = has ? '' : 'none';
    this.clearBtn.style.display = has ? '' : 'none';
    this.count.textContent = has ? num(this.items.length) : '';

    this.strip.replaceChildren(
      ...this.items.map((item) => {
        const icon = item.icon ? h('img', { src: item.icon, draggable: 'false' }) : html(item.isDir ? ICONS.shelf : ICONS.file);
        const el = h(
          'div',
          {
            class: 'sh-item' + (this.selected.has(item.id) ? ' on' : ''),
            draggable: 'true',
            title: item.path,
            onclick: () => {
              this.selected.has(item.id) ? this.selected.delete(item.id) : this.selected.add(item.id);
              el.classList.toggle('on', this.selected.has(item.id));
            },
            ondblclick: () => API.call('shelf:open', item.id),
            oncontextmenu: (e) => {
              e.preventDefault();
              API.call('shelf:reveal', item.id);
            },
            ondragstart: (e) => {
              e.preventDefault();
              const ids = this.selected.has(item.id) ? [...this.selected] : [item.id];
              API.send('shelf:drag', ids);
            },
          },
          h('div', { class: 'sh-icon' }, icon),
          h('div', { class: 'sh-name' }, item.name),
          item.isImage
            ? h(
                'div',
                { class: 'sh-acts' },
                ...[
                  ['png', 'PNG'],
                  ['jpg', 'JPG'],
                  ['webp', 'WebP'],
                  ['compress', LANG === 'ar' ? 'ضغط' : 'Compress'],
                  ['half', '½'],
                  ['resize-640', '640px'],
                  ['resize-1280', '1280px'],
                  ['ocr', 'OCR'],
                ].map(([op, label]) =>
                  h(
                    'button',
                    {
                      class: 'sh-act',
                      'data-interactive': '1',
                      title: t('img_' + op),
                      onclick: (e) => {
                        e.stopPropagation();
                        this.imageOp(item, op);
                      },
                    },
                    label
                  )
                )
              )
            : null,
          !item.isDir
            ? h(
                'div',
                { class: 'sh-acts' },
                ...(/\.pdf$/i.test(item.path)
                  ? [['pdf-optimize', LANG === 'ar' ? 'تحسين PDF' : 'Optimize PDF']]
                  : /\.(mp4|mkv|webm|mov)$/i.test(item.path)
                    ? [
                        ['gif', 'GIF'],
                        ['audio', LANG === 'ar' ? 'الصوت' : 'Audio'],
                      ]
                    : item.isImage
                      ? [['background', LANG === 'ar' ? 'إزالة الخلفية' : 'Remove background']]
                      : []
                ).map(([op, label]) =>
                  h(
                    'button',
                    {
                      class: 'sh-act',
                      'data-interactive': '1',
                      onclick: async (e) => {
                        e.stopPropagation();
                        const r = await API.call(op === 'pdf-optimize' ? 'files:process' : 'files:tool', op === 'pdf-optimize' ? [item.id] : item.id, op).catch(
                          (e) => ({ error: e.message })
                        );
                        Notice.show({
                          text: r.ok ? (LANG === 'ar' ? 'بدأت المعالجة / راجع المهام' : 'Processing started / See jobs') : r.error,
                        });
                      },
                    },
                    label
                  )
                )
              )
            : null,
          h(
            'div',
            { class: 'sh-acts' },
            h(
              'button',
              {
                class: 'sh-act',
                'data-interactive': '1',
                onclick: (e) => {
                  e.stopPropagation();
                  API.call('files:copy-path', item.id);
                },
              },
              LANG === 'ar' ? 'المسار' : 'Path'
            ),
            !item.isDir
              ? h(
                  'button',
                  {
                    class: 'sh-act',
                    'data-interactive': '1',
                    onclick: async (e) => {
                      e.stopPropagation();
                      const share = await API.call('files:share', item.id).catch((e) => ({ error: e.message }));
                      if (share.url) {
                        await API.call('assistant:copy', share.url);
                        Notice.show({
                          text: LANG === 'ar' ? 'نُسخ رابط المشاركة لعشر دقائق' : 'Share link copied for ten minutes',
                          detail: LANG === 'ar' ? 'متاح لمن يملك الرابط على الشبكة المحلية؛ غير مشفّر' : 'Available to link holders on your LAN; unencrypted',
                        });
                      } else Notice.show({ text: share.error });
                    },
                  },
                  'LAN'
                )
              : null
          ),
          h(
            'button',
            {
              class: 'x',
              'data-interactive': '1',
              onclick: (e) => {
                e.stopPropagation();
                API.call('shelf:remove', [item.id]);
              },
            },
            html(ICONS.close)
          )
        );
        return el;
      })
    );
  },

  async imageOp(item, op) {
    const width = op.startsWith('resize-') ? Number(op.split('-')[1]) : undefined;
    if (width) op = 'resize';
    const out = await API.call('files:process', [item.id], op, width).catch((e) => ({
      ok: false,
      error: e.message,
    }));
    if (out && out.text) {
      Island.feature('assistant').show(out.text);
      Island.open('assistant');
      return;
    }
    this.peekText.textContent = out && out.ok ? t('imgDone') : out?.error || t('imgFailed');
    Island.peek('shelf', 2400);
  },

  async processSelected(op) {
    const r = await API.call('files:process', [...this.selected], op).catch((e) => ({ error: e.message }));
    Notice.show({
      text: r.ok ? (LANG === 'ar' ? 'تم حفظ الملف في التنزيلات / Islandly' : 'Saved to Downloads / Islandly') : r.error,
    });
  },

  priority: () => 0,

  view(mode) {
    if (mode === 'peek') return { el: this.peekEl, w: 330, h: 64 };
    if (mode === 'expanded') return { el: this.expandedEl, w: 500, auto: true };
    return null;
  },
});
