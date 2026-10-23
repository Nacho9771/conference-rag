// Personal study state stays in memory until Save; Supabase RLS is authoritative.
(() => {
  const $ = id => document.getElementById(id);
  let user = null, currentId = '', sources = [], notebooks = [], dirty = false, generation = 0, revision = 0;
  const message = text => { $('notebook-message').textContent = text; };
  function changed() { revision++; dirty = true; message('Unsaved changes — save when you’re ready.'); }
  function resetEditor() {
    currentId = ''; sources = []; dirty = false;
    $('notebook-title').value = ''; $('notebook-notes').value = ''; $('notebook-purpose').value = 'study';
    renderSources();
  }
  function renderSources() {
    $('source-count').textContent = sources.length;
    const container = $('notebook-sources'); container.replaceChildren();
    if (!sources.length) { const p = document.createElement('p'); p.className = 'small'; p.textContent = 'Save passages from search results to keep them here.'; container.append(p); }
    sources.forEach((source, index) => {
      const card = document.createElement('div'); card.className = 'saved-source';
      const kind = document.createElement('div'); kind.className = 'source-kind'; kind.textContent = source.kind === 'ai' ? 'AI summary · verify against sources' : 'Conference source';
      const title = document.createElement('a'); title.textContent = source.title; title.href = safeSourceUrl(source.url); title.target = '_blank'; title.rel = 'noopener noreferrer';
      if (title.getAttribute('href') === '#') title.removeAttribute('href');
      const quote = document.createElement('blockquote'); quote.textContent = source.text;
      const remove = document.createElement('button'); remove.className = 'text-button'; remove.textContent = 'Remove'; remove.onclick = () => { sources.splice(index, 1); renderSources(); changed(); };
      card.append(kind, title, quote, remove); container.append(card);
    });
  }
  async function loadNotebooks() {
    const identity = user?.id, version = generation;
    if (!identity) return;
    const { data, error } = await supabaseClient.from('notebooks').select('*').eq('owner_id', identity).order('updated_at', { ascending: false });
    if (version !== generation || user?.id !== identity) return;
    if (error) { message(`Could not load notebooks: ${error.message}`); return; }
    notebooks = data; $('notebook-select').replaceChildren(new Option('New notebook', ''));
    notebooks.forEach(n => $('notebook-select').add(new Option(n.title, n.id)));
    $('notebook-select').value = currentId;
  }
  window.addEventListener('study-auth', event => {
    if (user?.id === event.detail?.id) return;
    generation++; user = event.detail; resetEditor(); notebooks = [];
    $('notebook-select').replaceChildren(new Option('New notebook', ''));
    if (user) loadNotebooks();
  });
  $('notebook-select').addEventListener('change', () => {
    if (dirty && !confirm('Discard unsaved notebook changes?')) { $('notebook-select').value = currentId; return; }
    const selected = notebooks.find(n => n.id === $('notebook-select').value);
    resetEditor();
    if (selected) {
      currentId = selected.id; sources = structuredClone(selected.sources);
      $('notebook-title').value = selected.title; $('notebook-notes').value = selected.notes; $('notebook-purpose').value = selected.purpose; renderSources();
    }
    message('Your notes are visible only to you.');
  });
  for (const id of ['notebook-title','notebook-notes','notebook-purpose']) $(id).addEventListener('input', changed);
  $('save-notebook').addEventListener('click', async () => {
    if (!user) return;
    const title = $('notebook-title').value.trim();
    if (!title) { message('Give your notebook a title first.'); $('notebook-title').focus(); return; }
    const identity = user.id, version = generation, savedRevision = revision;
    const payload = { owner_id: identity, title, notes: $('notebook-notes').value, purpose: $('notebook-purpose').value, sources, updated_at: new Date().toISOString() };
    $('save-notebook').disabled = true;
    const query = currentId ? supabaseClient.from('notebooks').update(payload).eq('id', currentId).eq('owner_id', identity) : supabaseClient.from('notebooks').insert(payload);
    try {
      const { data, error } = await query.select('id').single();
      if (version !== generation) return;
      if (error) throw error;
      currentId = data.id; dirty = revision !== savedRevision;
      message(dirty ? 'Saved. You have newer unsaved changes.' : 'Saved to your private notebook.'); await loadNotebooks();
    } catch(error) { message(`Could not save: ${error.message}`); }
    finally { $('save-notebook').disabled = false; }
  });
  window.addEventListener('study-results', event => {
    const root = $(`${event.detail}-results`);
    root?.querySelectorAll('.result-card').forEach(card => {
      const btn = document.createElement('button'); btn.className = 'save-source'; btn.textContent = '＋ Keep in notebook';
      btn.onclick = () => {
        if (sources.length >= 50) { message('This notebook has 50 sources. Start another notebook to collect more.'); return; }
        const link = card.querySelector('a');
        const source = { title: card.querySelector('.result-title')?.textContent || 'Saved passage', url: link?.getAttribute('href') || '', text: card.querySelector('.result-sentences')?.textContent || '', kind: card.classList.contains('rag-answer') ? 'ai' : 'source' };
        // Preserve citations when an AI summary is kept or exported.
        if (source.kind === 'ai') source.text += '\n\nSources:\n' + [...root.querySelectorAll('.result-source a')].map(a => `${a.textContent}: ${a.href}`).join('\n');
        if (sources.some(s => s.title === source.title && s.text === source.text)) { message('That passage is already in this notebook.'); return; }
        sources.push(source); renderSources(); changed(); btn.textContent = 'Kept ✓';
      };
      card.append(btn);
    });
  });
  $('export-notebook').addEventListener('click', () => {
    const title = $('notebook-title').value.trim() || 'Study notebook';
    const markdown = `# ${title}\n\n## My thoughts & outline\n\n${$('notebook-notes').value}\n\n## Collected sources\n\n` + sources.map(s => `### ${s.title}\n${s.kind === 'ai' ? 'AI summary — verify against sources' : 'Conference source'}\n\n${s.text}\n\n${s.url}\n`).join('\n');
    const url = URL.createObjectURL(new Blob([markdown], { type:'text/markdown;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = title.replace(/[^a-z0-9 -]/gi,'').slice(0,80) + '.md'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  $('logout-btn').addEventListener('click', event => {
    if (dirty && !confirm('Sign out and discard unsaved notebook changes?')) { event.stopImmediatePropagation(); }
  }, true);
  const tabs = [...document.querySelectorAll('[data-mode]')];
  function selectMode(mode) { tabs.forEach(tab => { const selected = tab.dataset.mode === mode; tab.setAttribute('aria-selected', selected); tab.tabIndex = selected ? 0 : -1; $(`${tab.dataset.mode}-panel`).classList.toggle('hidden', !selected); }); }
  tabs.forEach((tab,i) => { tab.onclick = () => selectMode(tab.dataset.mode); tab.onkeydown = event => { if (['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); const next = tabs[(i + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; selectMode(next.dataset.mode); next.focus(); } }; });
  selectMode('rag');
  document.querySelectorAll('[data-prompt]').forEach(btn => btn.onclick = () => { $('rag-input').value = btn.dataset.prompt; $('rag-input').focus(); });
  $('signin-form').addEventListener('submit', event => { event.preventDefault(); $('login-btn').click(); });
})();
