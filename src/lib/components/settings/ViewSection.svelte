<script lang="ts">
  import type { Preferences } from '$lib/stores/preferences';
  import type { TranslationKey } from '$lib/i18n/index';

  interface Props {
    prefs: Preferences;
    tr: (key: TranslationKey) => string;
    applyPrefs: () => void;
  }

  let { prefs = $bindable(), tr, applyPrefs }: Props = $props();
</script>

<div class="setting-group">
  <h3>{tr('display_modes')}</h3>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('source_code_mode')}</span><p class="setting-desc">{tr('source_code_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.sourceCodeMode} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('focus_mode')}</span><p class="setting-desc">{tr('focus_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.focusMode} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('typewriter_mode')}</span><p class="setting-desc">{tr('typewriter_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.typewriterMode} onchange={() => { if (!prefs.typewriterMode) prefs.typewriterSounds = false; applyPrefs(); }} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('typewriter_sounds')}</span><p class="setting-desc">{tr('typewriter_sounds_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.typewriterSounds} disabled={!prefs.typewriterMode} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('split_view')}</span><p class="setting-desc">{tr('split_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.splitView} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
</div>
<div class="setting-group">
  <h3>{tr('interface')}</h3>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('sidebar_startup')}</span><p class="setting-desc">{tr('sidebar_startup_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.sidebarVisible} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('tab_bar')}</span><p class="setting-desc">{tr('tab_bar_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.showTabBar} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('status_bar')}</span><p class="setting-desc">{tr('status_bar_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.showStatusBar} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
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
