<script lang="ts">
  import type { Preferences } from '$lib/stores/preferences';
  import type { TranslationKey } from '$lib/i18n/index';
  import CustomSelect from '../CustomSelect.svelte';

  interface Props {
    prefs: Preferences;
    tr: (key: TranslationKey) => string;
    applyPrefs: () => void;
  }

  let { prefs = $bindable(), tr, applyPrefs }: Props = $props();
</script>

<div class="setting-group">
  <h3>{tr('font')}</h3>
  <div class="setting-row"><span class="setting-label">{tr('font_family')}</span>
    <CustomSelect
      options={[
        { value: "system-ui, -apple-system, sans-serif", label: "System" },
        { value: "serif", label: "Serif" },
        { value: "sans-serif", label: "Sans-serif" },
        { value: "monospace", label: "Monospace" },
        { value: "cursive", label: "Cursive" },
        { value: "'Noto Sans', sans-serif", label: "Noto Sans" },
        { value: "'DejaVu Sans', sans-serif", label: "DejaVu Sans" },
        { value: "'Liberation Sans', sans-serif", label: "Liberation Sans" },
        { value: "'Ubuntu', sans-serif", label: "Ubuntu" },
        { value: "'Noto Serif', serif", label: "Noto Serif" },
        { value: "'DejaVu Serif', serif", label: "DejaVu Serif" },
        { value: "'Liberation Mono', monospace", label: "Liberation Mono" },
        { value: "'DejaVu Sans Mono', monospace", label: "DejaVu Sans Mono" },
      ]}
      value={prefs.fontFamily}
      onchange={(v) => { prefs.fontFamily = v; document.documentElement.style.setProperty('--font-family', v); applyPrefs(); }}
    />
  </div>
  <div class="setting-row"><span class="setting-label">{tr('font_size')}</span><div class="setting-control"><input type="range" min="12" max="28" bind:value={prefs.fontSize} onchange={applyPrefs} /><span class="setting-val">{prefs.fontSize}px</span></div></div>
  <div class="setting-row"><span class="setting-label">{tr('line_height')}</span><div class="setting-control"><input type="range" min="1.2" max="2.4" step="0.1" bind:value={prefs.lineHeight} onchange={applyPrefs} /><span class="setting-val">{prefs.lineHeight}</span></div></div>
</div>
<div class="setting-group">
  <h3>{tr('code_font')}</h3>
  <div class="setting-row"><span class="setting-label">{tr('code_font_family')}</span>
    <CustomSelect
      options={[
        { value: "DejaVu Sans Mono", label: "DejaVu Sans Mono" },
        { value: "Liberation Mono", label: "Liberation Mono" },
        { value: "Fira Code", label: "Fira Code" },
        { value: "JetBrains Mono", label: "JetBrains Mono" },
        { value: "Source Code Pro", label: "Source Code Pro" },
        { value: "Ubuntu Mono", label: "Ubuntu Mono" },
        { value: "Cascadia Code", label: "Cascadia Code" },
        { value: "monospace", label: "monospace" },
      ]}
      value={prefs.codeFontFamily}
      onchange={(v) => { prefs.codeFontFamily = v; applyPrefs(); }}
    />
  </div>
  <div class="setting-row"><span class="setting-label">{tr('code_font_size')}</span><div class="setting-control"><input type="range" min="12" max="28" bind:value={prefs.codeFontSize} onchange={applyPrefs} /><span class="setting-val">{prefs.codeFontSize}px</span></div></div>
</div>
<div class="setting-group">
  <h3>{tr('behavior')}</h3>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('word_wrap')}</span><p class="setting-desc">{tr('word_wrap_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.wordWrap} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('spellcheck')}</span><p class="setting-desc">{tr('spellcheck_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.spellcheck} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('line_numbers')}</span><p class="setting-desc">{tr('line_numbers_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.showLineNumbers} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('code_block_line_numbers')}</span><p class="setting-desc">{tr('code_block_line_numbers_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.codeBlockLineNumbers} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('editor_line_numbers')}</span><p class="setting-desc">{tr('editor_line_numbers_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.editorLineNumbers} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row">
    <span class="setting-label">{tr('tab_size_label')}</span>
    <div class="setting-control"><input type="range" min="1" max="8" bind:value={prefs.tabSize} onchange={applyPrefs} /><span class="setting-val">{prefs.tabSize}</span></div>
  </div>
  <div class="setting-row">
    <span class="setting-label">{tr('end_of_line')}</span>
    <CustomSelect
      options={[
        { value: 'default', label: tr('eol_default') },
        { value: 'lf', label: 'LF (\\n)' },
        { value: 'crlf', label: 'CRLF (\\r\\n)' },
      ]}
      value={prefs.endOfLine}
      onchange={(v) => { prefs.endOfLine = v; applyPrefs(); }}
    />
  </div>
  <div class="setting-row">
    <span class="setting-label">{tr('text_direction')}</span>
    <CustomSelect
      options={[
        { value: 'ltr', label: tr('dir_ltr') },
        { value: 'rtl', label: tr('dir_rtl') },
      ]}
      value={prefs.textDirection}
      onchange={(v) => { prefs.textDirection = v; applyPrefs(); }}
    />
  </div>
  <div class="setting-row">
    <span class="setting-label">{tr('editor_line_width')}</span>
    <input class="setting-input" type="text" placeholder="e.g. 80ch, 800px, 100%" bind:value={prefs.editorLineWidth} onchange={applyPrefs} />
  </div>
  <div class="setting-row">
    <span class="setting-label">{tr('trim_trailing_newline')}</span>
    <CustomSelect
      options={[
        { value: '0', label: tr('trim_nothing') },
        { value: '1', label: tr('trim_one') },
        { value: '2', label: tr('trim_default') },
        { value: '3', label: tr('trim_all') },
      ]}
      value={String(prefs.trimTrailingNewline)}
      onchange={(v) => { prefs.trimTrailingNewline = Number(v); applyPrefs(); }}
    />
  </div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('trim_code_block_empty_lines')}</span><p class="setting-desc">{tr('trim_code_block_empty_lines_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.trimUnnecessaryCodeBlockEmptyLines} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('hide_quick_insert_hint')}</span><p class="setting-desc">{tr('hide_quick_insert_hint_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.hideQuickInsertHint} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('hide_link_popup')}</span><p class="setting-desc">{tr('hide_link_popup_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.hideLinkPopup} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('auto_check')}</span><p class="setting-desc">{tr('auto_check_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.autoCheck} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
</div>
<div class="setting-group">
  <h3>{tr('auto_pair')}</h3>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('auto_pair_bracket')}</span><p class="setting-desc">{tr('auto_pair_bracket_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.autoPairBracket} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('auto_pair_markdown_syntax')}</span><p class="setting-desc">{tr('auto_pair_markdown_syntax_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.autoPairMarkdownSyntax} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('auto_pair_quote')}</span><p class="setting-desc">{tr('auto_pair_quote_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.autoPairQuote} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
</div>

<style>
  .setting-group {
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .setting-group:last-child { border-bottom: none; }

  .setting-group h3 {
    font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 10px;
  }

  .setting-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 7px 0;
  }

  .toggle-row { align-items: flex-start; }

  .setting-label { font-size: 0.82rem; color: var(--text-primary); }
  .setting-desc { font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; }

  .setting-control { display: flex; align-items: center; gap: 8px; }

  .setting-val {
    font-size: 0.75rem; color: var(--text-secondary); min-width: 32px;
    text-align: right; font-family: var(--font-mono);
  }

  input[type="range"] { width: 120px; accent-color: var(--accent); cursor: pointer; }

  .setting-input {
    background: var(--bg-secondary); border: 1px solid var(--border);
    border-radius: 5px; padding: 5px 10px; color: var(--text-primary);
    font-size: 0.8rem; font-family: var(--font-family); min-width: 140px;
  }
  .setting-input:focus { outline: none; border-color: var(--accent); }

  .toggle {
    position: relative; display: inline-block; width: 38px; height: 20px;
    flex-shrink: 0; cursor: pointer;
  }
  .toggle input { opacity: 0; width: 0; height: 0; }

  .toggle-slider {
    position: absolute; inset: 0; background: var(--bg-hover);
    border-radius: 10px; transition: .2s;
  }
  .toggle-slider::before {
    content: ''; position: absolute; height: 14px; width: 14px;
    left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: .2s;
  }
  .toggle input:checked + .toggle-slider { background: var(--accent); }
  .toggle input:checked + .toggle-slider::before { transform: translateX(18px); }
</style>
