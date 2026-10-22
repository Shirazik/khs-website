// In-page editor, loaded only by scripts/edit.mjs. Makes the text in <main>
// editable, adds controls to move, copy and delete list items, and posts the
// cleaned-up <main> back to the server to be written into index.html.

(function () {
  var main = document.querySelector('main');
  var EDITABLE = 'h2, p, ul.notes > li, summary > span, summary > time, details li';
  var ITEM = 'li, p';
  var dirty = false;
  var current = null;

  main.querySelectorAll('details').forEach(function (d) { d.open = true; });
  main.querySelectorAll(EDITABLE).forEach(function (el) { el.contentEditable = 'true'; });

  // Toolbar along the bottom.
  var bar = document.createElement('div');
  bar.className = 'ed-bar';
  bar.innerHTML =
    '<span class="ed-status">Click any text to edit it.</span>' +
    '<button type="button" data-act="link" title="Add, change or remove a link (⌘K)">Link</button>' +
    '<button type="button" data-act="save" class="ed-primary" title="Write to index.html (⌘S)">Save</button>' +
    '<button type="button" data-act="publish">Publish</button>';
  document.body.appendChild(bar);
  var status = bar.querySelector('.ed-status');
  var publishBtn = bar.querySelector('[data-act="publish"]');

  fetch('/__editor/branch').then(function (r) { return r.json(); }).then(function (d) {
    publishBtn.title = 'Commit index.html and push ' + d.branch +
      (d.branch === 'main' ? ' (deploys the site)' : ' (does not deploy: not main)');
  });

  // Controls for the item being edited.
  var tools = document.createElement('div');
  tools.className = 'ed-tools';
  tools.innerHTML =
    '<button type="button" data-act="up" title="Move up">↑</button>' +
    '<button type="button" data-act="down" title="Move down">↓</button>' +
    '<button type="button" data-act="copy" title="Duplicate (to add a new one)">Duplicate</button>' +
    '<button type="button" data-act="delete" title="Delete">Delete</button>';
  document.body.appendChild(tools);

  function setStatus(text, kind) {
    status.textContent = text;
    status.dataset.kind = kind || '';
  }
  function markDirty() {
    dirty = true;
    setStatus('Unsaved changes', 'dirty');
  }
  function place() {
    if (!current || !main.contains(current)) { tools.hidden = true; return; }
    var r = current.getBoundingClientRect();
    tools.hidden = false;
    tools.style.top = (r.top + scrollY - tools.offsetHeight - 4) + 'px';
    tools.style.left = Math.max(8, r.right + scrollX - tools.offsetWidth) + 'px';
  }

  main.addEventListener('focusin', function (e) {
    current = e.target.closest(ITEM);
    place();
  });
  addEventListener('resize', place);
  main.addEventListener('input', function () { markDirty(); place(); });

  // Keep the rows open and links inert while editing (⌘-click still opens a link).
  main.addEventListener('click', function (e) {
    if (e.target.closest('summary')) e.preventDefault();
    var a = e.target.closest('a');
    if (a && !(e.metaKey || e.ctrlKey)) e.preventDefault();
  });

  main.addEventListener('keydown', function (e) {
    // One line per item: use Duplicate for a new one.
    if (e.key === 'Enter') e.preventDefault();
    // Space in a <summary> would toggle the row instead of typing.
    if (e.key === ' ' && e.target.closest('summary')) {
      e.preventDefault();
      document.execCommand('insertText', false, ' ');
    }
  });

  main.addEventListener('paste', function (e) {
    e.preventDefault();
    var text = (e.clipboardData.getData('text/plain') || '').replace(/\s+/g, ' ');
    document.execCommand('insertText', false, text);
  });

  tools.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep focus in the text
  tools.addEventListener('click', function (e) {
    var act = e.target.dataset.act;
    if (!act || !current) return;
    var el = current;
    if (act === 'up' && el.previousElementSibling) el.parentNode.insertBefore(el, el.previousElementSibling);
    if (act === 'down' && el.nextElementSibling) el.parentNode.insertBefore(el.nextElementSibling, el);
    if (act === 'copy') {
      var copy = el.cloneNode(true);
      el.after(document.createTextNode('\n' + indent(el)), copy);
      current = copy;
      var first = copy.matches('[contenteditable]') ? copy : copy.querySelector('[contenteditable]');
      if (first) focusEnd(first);
    }
    if (act === 'delete') {
      if (!confirm('Delete this item?')) return;
      var prev = el.previousSibling;
      if (prev && prev.nodeType === 3 && !prev.textContent.trim()) prev.remove();
      el.remove();
      current = null;
    }
    markDirty();
    place();
  });

  // Whitespace before an element, so a duplicate lines up in index.html.
  function indent(el) {
    var prev = el.previousSibling;
    var m = prev && prev.nodeType === 3 && prev.textContent.match(/[ \t]*$/);
    return m ? m[0] : '';
  }
  function focusEnd(el) {
    el.focus();
    var range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    var sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function link() {
    var sel = getSelection();
    if (!sel.rangeCount || !main.contains(sel.anchorNode)) return alert('Select some text first.');
    var node = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
    var a = node.closest('a');
    if (a) {
      var href = prompt('Link address (leave empty to remove the link):', a.getAttribute('href'));
      if (href === null) return;
      if (href.trim()) a.setAttribute('href', href.trim());
      else a.replaceWith.apply(a, a.childNodes);
    } else {
      if (sel.isCollapsed) return alert('Select the words to link first.');
      var url = prompt('Link address:', 'https://');
      if (!url || !url.trim()) return;
      document.execCommand('createLink', false, url.trim());
    }
    // Links off the site open in a new tab, like the rest of the page's.
    main.querySelectorAll('a[href]').forEach(function (a) {
      if (/^https?:/.test(a.getAttribute('href'))) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
      } else {
        a.removeAttribute('target');
        a.removeAttribute('rel');
      }
    });
    markDirty();
  }

  // A copy of <main> with the editor's attributes taken back out.
  function cleanHTML() {
    var clone = main.cloneNode(true);
    clone.querySelectorAll('[contenteditable]').forEach(function (el) { el.removeAttribute('contenteditable'); });
    clone.querySelectorAll('details').forEach(function (el) { el.removeAttribute('open'); });
    clone.querySelectorAll('[style]').forEach(function (el) { el.removeAttribute('style'); });
    clone.querySelectorAll('br').forEach(function (el) { el.remove(); });
    return clone.innerHTML;
  }

  function post(path, data) {
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {}) })
      .catch(function () {
        // Edits live only in this page until saved, so say how to keep them.
        throw new Error('the editor server is not running. Run "npm run edit" again, then press Save (don\'t reload this page).');
      })
      .then(function (r) {
        return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || r.statusText); return d; });
      });
  }

  function save() {
    setStatus('Saving…');
    return post('/__editor/save', { main: cleanHTML() }).then(function () {
      dirty = false;
      setStatus('Saved to index.html', 'ok');
    }, function (err) {
      setStatus('Save failed: ' + err.message, 'error');
      throw err;
    });
  }

  function publish() {
    if (!confirm(publishBtn.title + '?')) return;
    (dirty ? save() : Promise.resolve()).then(function () {
      setStatus('Publishing…');
      return post('/__editor/publish').then(function (d) {
        setStatus(d.branch === 'main' ? 'Pushed to main. Live in a minute or two.' : 'Pushed ' + d.branch + '.', 'ok');
      });
    }).catch(function (err) { setStatus('Publish failed: ' + err.message, 'error'); });
  }

  bar.addEventListener('mousedown', function (e) { if (e.target.dataset.act === 'link') e.preventDefault(); });
  bar.addEventListener('click', function (e) {
    var act = e.target.dataset.act;
    if (act === 'link') link();
    if (act === 'save') save().catch(function () {});
    if (act === 'publish') publish();
  });

  addEventListener('keydown', function (e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === 's') { e.preventDefault(); save().catch(function () {}); }
    if (e.key === 'k') { e.preventDefault(); link(); }
  });

  addEventListener('beforeunload', function (e) { if (dirty) e.preventDefault(); });
})();
