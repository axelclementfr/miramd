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
  <h3>{tr('md_options')}</h3>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('prefer_loose_list')}</span><p class="setting-desc">{tr('prefer_loose_list_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.preferLooseListItem} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row">
    <span class="setting-label">{tr('bullet_list_marker')}</span>
    <CustomSelect
      options={[
        { value: '-', label: '- (dash)' },
        { value: '*', label: '* (asterisk)' },
        { value: '+', label: '+ (plus)' },
      ]}
      value={prefs.bulletListMarker}
      onchange={(v) => { prefs.bulletListMarker = v; applyPrefs(); }}
    />
  </div>
  <div class="setting-row">
    <span class="setting-label">{tr('order_list_delimiter')}</span>
    <CustomSelect
      options={[
        { value: '.', label: '. (dot)' },
        { value: ')', label: ') (paren)' },
      ]}
      value={prefs.orderListDelimiter}
      onchange={(v) => { prefs.orderListDelimiter = v; applyPrefs(); }}
    />
  </div>
  <div class="setting-row">
    <span class="setting-label">{tr('prefer_heading_style')}</span>
    <CustomSelect
      options={[
        { value: 'atx', label: 'ATX (# heading)' },
        { value: 'setext', label: 'Setext (underline)' },
      ]}
      value={prefs.preferHeadingStyle}
      onchange={(v) => { prefs.preferHeadingStyle = v; applyPrefs(); }}
    />
  </div>
  <div class="setting-row">
    <span class="setting-label">{tr('list_indentation')}</span>
    <CustomSelect
      options={[
        { value: '1', label: '1' },
        { value: '2', label: '2' },
        { value: '3', label: '3' },
        { value: '4', label: '4' },
        { value: 'dfm', label: 'dfm' },
        { value: 'tab', label: 'tab' },
      ]}
      value={String(prefs.listIndentation)}
      onchange={(v) => { prefs.listIndentation = isNaN(Number(v)) ? v : Number(v); applyPrefs(); }}
    />
  </div>
  <div class="setting-row">
    <span class="setting-label">{tr('frontmatter_type')}</span>
    <CustomSelect
      options={[
        { value: '-', label: 'YAML (---)' },
        { value: '+', label: 'TOML (+++)' },
        { value: ';', label: 'JSON (;;;)' },
        { value: '{', label: 'JSON ({})' },
      ]}
      value={prefs.frontmatterType}
      onchange={(v) => { prefs.frontmatterType = v; applyPrefs(); }}
    />
  </div>
</div>
<div class="setting-group">
  <h3>{tr('md_extensions')}</h3>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('super_sub_script')}</span><p class="setting-desc">{tr('super_sub_script_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.superSubScript} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('footnote_label')}</span><p class="setting-desc">{tr('footnote_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.footnote} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('html_enabled')}</span><p class="setting-desc">{tr('html_enabled_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.isHtmlEnabled} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
  <div class="setting-row toggle-row"><div><span class="setting-label">{tr('gitlab_compat')}</span><p class="setting-desc">{tr('gitlab_compat_desc')}</p></div><label class="toggle"><input type="checkbox" bind:checked={prefs.isGitlabCompatibilityEnabled} onchange={applyPrefs} /><span class="toggle-slider"></span></label></div>
</div>
<div class="setting-group">
  <h3>{tr('diagram_themes')}</h3>
  <div class="setting-row">
    <span class="setting-label">{tr('sequence_theme')}</span>
    <CustomSelect
      options={[
        { value: 'hand', label: 'Hand' },
        { value: 'simple', label: 'Simple' },
      ]}
      value={prefs.sequenceTheme}
      onchange={(v) => { prefs.sequenceTheme = v; applyPrefs(); }}
    />
  </div>
  <div class="setting-row">
    <span class="setting-label">{tr('mermaid_theme')}</span>
    <CustomSelect
      options={[
        { value: 'default', label: 'Default' },
        { value: 'dark', label: 'Dark' },
        { value: 'forest', label: 'Forest' },
        { value: 'neutral', label: 'Neutral' },
      ]}
      value={prefs.mermaidTheme}
      onchange={(v) => { prefs.mermaidTheme = v; applyPrefs(); }}
    />
  </div>
  <div class="setting-row">
    <span class="setting-label">{tr('vega_theme')}</span>
    <CustomSelect
      options={[
        { value: 'latimes', label: 'LA Times' },
        { value: 'fivethirtyeight', label: 'FiveThirtyEight' },
        { value: 'ggplot2', label: 'ggplot2' },
        { value: 'quartz', label: 'Quartz' },
        { value: 'vox', label: 'Vox' },
        { value: 'dark', label: 'Dark' },
      ]}
      value={prefs.vegaTheme}
      onchange={(v) => { prefs.vegaTheme = v; applyPrefs(); }}
    />
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
