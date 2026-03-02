<script lang="ts">
  import type { Preferences } from '$lib/stores/preferences';
  import { setLanguage, type TranslationKey } from '$lib/i18n/index';
  import CustomSelect from '../CustomSelect.svelte';

  interface Props {
    prefs: Preferences;
    tr: (key: TranslationKey) => string;
    applyPrefs: () => void;
  }

  let { prefs = $bindable(), tr, applyPrefs }: Props = $props();

  const languages = [
    { code: 'fr', label: 'Fran\u00e7ais' },
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Espa\u00f1ol' },
    { code: 'de', label: 'Deutsch' },
    { code: 'it', label: 'Italiano' },
    { code: 'pt', label: 'Portugu\u00eas' },
    { code: 'ja', label: '\u65e5\u672c\u8a9e' },
    { code: 'zh', label: '\u4e2d\u6587' },
  ];
</script>

<div class="setting-group">
  <h3>{tr('language')}</h3>
  <div class="setting-row">
    <span class="setting-label">{tr('ui_language')}</span>
    <CustomSelect
      options={languages.map(l => ({ value: l.code, label: l.label }))}
      value={prefs.language}
      onchange={(v) => { prefs.language = v; setLanguage(v); applyPrefs(); }}
    />
  </div>
</div>
<div class="setting-group">
  <h3>{tr('save_section')}</h3>
  <div class="setting-row toggle-row">
    <div><span class="setting-label">{tr('auto_save')}</span><p class="setting-desc">{tr('auto_save_desc')}</p></div>
    <label class="toggle"><input type="checkbox" bind:checked={prefs.autoSave} onchange={applyPrefs} /><span class="toggle-slider"></span></label>
  </div>
  {#if prefs.autoSave}
    <div class="setting-row">
      <span class="setting-label">{tr('save_delay')}</span>
      <div class="setting-control"><input type="range" min="1000" max="600000" step="1000" bind:value={prefs.autoSaveDelay} oninput={applyPrefs} /><span class="setting-val">{prefs.autoSaveDelay >= 60000 ? `${Math.round(prefs.autoSaveDelay / 60000)}min` : `${Math.round(prefs.autoSaveDelay / 1000)}s`}</span></div>
    </div>
  {/if}
</div>
<div class="setting-group">
  <h3>{tr('general_startup')}</h3>
  <div class="setting-row">
    <span class="setting-label">{tr('start_up_action')}</span>
    <CustomSelect
      options={[
        { value: 'blank', label: tr('startup_blank') },
        { value: 'lastState', label: tr('startup_last_state') },
        { value: 'folder', label: tr('startup_folder') },
      ]}
      value={prefs.startUpAction}
      onchange={(v) => { prefs.startUpAction = v; applyPrefs(); }}
    />
  </div>
  <div class="setting-row">
    <span class="setting-label">{tr('zoom_label')}</span>
    <div class="setting-control"><input type="range" min="0.5" max="2.0" step="0.1" bind:value={prefs.zoom} oninput={applyPrefs} /><span class="setting-val">{Math.round(prefs.zoom * 100)}%</span></div>
  </div>
  <div class="setting-row">
    <span class="setting-label">{tr('file_sort_by')}</span>
    <CustomSelect
      options={[
        { value: 'modified', label: tr('sort_modified') },
        { value: 'created', label: tr('sort_created') },
        { value: 'title', label: tr('sort_title') },
      ]}
      value={prefs.fileSortBy}
      onchange={(v) => { prefs.fileSortBy = v; applyPrefs(); }}
    />
  </div>
  <div class="setting-row toggle-row">
    <div><span class="setting-label">{tr('hide_scrollbar')}</span><p class="setting-desc">{tr('hide_scrollbar_desc')}</p></div>
    <label class="toggle"><input type="checkbox" bind:checked={prefs.hideScrollbar} onchange={applyPrefs} /><span class="toggle-slider"></span></label>
  </div>
  <div class="setting-row toggle-row">
    <div><span class="setting-label">{tr('word_wrap_in_toc')}</span><p class="setting-desc">{tr('word_wrap_in_toc_desc')}</p></div>
    <label class="toggle"><input type="checkbox" bind:checked={prefs.wordWrapInToc} onchange={applyPrefs} /><span class="toggle-slider"></span></label>
  </div>
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
