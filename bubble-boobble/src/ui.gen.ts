// @generated — do not edit. Regenerate with `pnpm gen` (tools/bindgen).
// This project's UI documents (ui/**/*.ui.json, ADR 0122) as types: `<Widget doc="…">` checks its
// props, codeAreas and refs against them. Types only: nothing imports this file at run time.
// Events are the names `onIntent` hears: `<id>` is the placing `<Widget>`'s `id` or `eventKey` (else a slug of
// its first text property's value, else the document's name), or in a document the use's key; `<item>` is a
// Repeat item's key.
import type { LocText } from '@gameengine/ui';

declare module '@gameengine/ui' {
  interface UiDocumentTypes {
    /**
     * Desktop account: a view, screen (ui/docs/desktop-account.ui.json)
     *
     * Properties:
     *   - `page`: enum profiles | scores | new-profile | settings, default "profiles"
     *   - `title`: text, default ""
     *   - `subtitle`: text, default ""
     *   - `name`: text, default ""
     *   - `status`: text, default ""
     *   - `statsName`: text, default ""
     *   - `stats`: text, default ""
     *   - `avatarName`: text, default ""
     *   - `backSelected`: yesno, default false
     *   - `newSelected`: yesno, default false
     *   - `spaceSelected`: yesno, default false
     *   - `deleteSelected`: yesno, default false
     *   - `createSelected`: yesno, default false
     *   - `cancelSelected`: yesno, default false
     *   - `showStatus`: yesno, default false
     *   - `profiles`: list of desktop-profile-row
     *   - `scores`: list of desktop-score-row
     *   - `keyRows`: list of desktop-key-row
     *   - `settings`: list of desktop-button
     * Events: `pick (<item>)`, `new-profile`, `menu`, `press (<item>) (<item>)`, `space`, `delete-char`, `create-profile`, `profiles`, `press (<item>)`
     * Code areas: `settingsAvatar`
     * Refs: `heading`, `new-profile`, `menu`, `menu`, `space`, `delete-char`, `create-profile`, `profiles`
     */
    'desktop-account': {
      props: { page: 'profiles' | 'scores' | 'new-profile' | 'settings'; title: string | { loc: string } | LocText; subtitle: string | { loc: string } | LocText; name: string | { loc: string } | LocText; status: string | { loc: string } | LocText; statsName: string | { loc: string } | LocText; stats: string | { loc: string } | LocText; avatarName: string | { loc: string } | LocText; backSelected: boolean; newSelected: boolean; spaceSelected: boolean; deleteSelected: boolean; createSelected: boolean; cancelSelected: boolean; showStatus: boolean; profiles: readonly { key: string; label?: string | { loc: string } | LocText; avatar?: string; selected?: boolean }[]; scores: readonly { key: string; name?: string | { loc: string } | LocText; score?: string | { loc: string } | LocText; round?: string | { loc: string } | LocText; record?: string | { loc: string } | LocText }[]; keyRows: readonly { key: string; keys?: readonly { key: string; label?: string | { loc: string } | LocText; selected?: boolean }[] }[]; settings: readonly { key: string; label?: string | { loc: string } | LocText; selected?: boolean }[] };
      areas: 'settingsAvatar';
      refs: 'heading' | 'new-profile' | 'menu' | 'space' | 'delete-char' | 'create-profile' | 'profiles';
    };
    /**
     * Desktop button: a widget, button (ui/docs/desktop-button.ui.json)
     *
     * Properties:
     *   - `label`: text, default "BACK"
     *   - `selected`: yesno, default false
     * Events: `<id>`
     * Code areas: none
     * Refs: none
     */
    'desktop-button': {
      props: { label: string | { loc: string } | LocText; selected: boolean };
      areas: never;
      refs: never;
    };
    /**
     * Desktop cell: a widget, button (ui/docs/desktop-cell.ui.json)
     *
     * Properties:
     *   - `image`: image, default "ui/sprites/star"
     *   - `label`: text, default ""
     * Events: `<id>`
     * Code areas: none
     * Refs: none
     */
    'desktop-cell': {
      props: { image: string; label: string | { loc: string } | LocText };
      areas: never;
      refs: never;
    };
    /**
     * Desktop editor: a view, screen (ui/docs/desktop-editor.ui.json)
     *
     * Properties:
     *   - `subtitle`: text, default ""
     *   - `status`: text, default ""
     *   - `rows`: list of desktop-grid-row
     *   - `toolbar`: list of desktop-small-button
     *   - `tools`: list of desktop-editor-button
     *   - `buttons`: list of desktop-small-button
     *   - `footer`: list of desktop-editor-button
     *   - `copyLabel`: text, default ""
     *   - `elementLabel`: text, default ""
     *   - `themeLabel`: text, default ""
     *   - `sel0`: yesno, default false
     *   - `sel1`: yesno, default false
     *   - `sel2`: yesno, default false
     *   - `sel3`: yesno, default false
     *   - `sel4`: yesno, default false
     *   - `sel16`: yesno, default false
     *   - `sel17`: yesno, default false
     *   - `sel18`: yesno, default false
     *   - `sel19`: yesno, default false
     *   - `sel20`: yesno, default false
     *   - `sel21`: yesno, default false
     *   - `enemyCount`: text, default ""
     * Events: `press (<item>)`, `template-prev`, `template`, `template-next`, `new`, `undo`, `save-level`, `load-level`, `test-level`, `menu`, `element`, `theme`
     * Code areas: none
     * Refs: `template-prev`, `template`, `template-next`, `new`, `undo`, `save-level`, `load-level`, `test-level`, `menu`, `element`, `theme`
     */
    'desktop-editor': {
      props: { subtitle: string | { loc: string } | LocText; status: string | { loc: string } | LocText; rows: readonly { key: string; cells?: readonly { key: string; image?: string; label?: string | { loc: string } | LocText }[] }[]; toolbar: readonly { key: string; label?: string | { loc: string } | LocText; selected?: boolean }[]; tools: readonly { key: string; label?: string | { loc: string } | LocText; selected?: boolean }[]; buttons: readonly { key: string; label?: string | { loc: string } | LocText; selected?: boolean }[]; footer: readonly { key: string; label?: string | { loc: string } | LocText; selected?: boolean }[]; copyLabel: string | { loc: string } | LocText; elementLabel: string | { loc: string } | LocText; themeLabel: string | { loc: string } | LocText; sel0: boolean; sel1: boolean; sel2: boolean; sel3: boolean; sel4: boolean; sel16: boolean; sel17: boolean; sel18: boolean; sel19: boolean; sel20: boolean; sel21: boolean; enemyCount: string | { loc: string } | LocText };
      areas: never;
      refs: 'template-prev' | 'template' | 'template-next' | 'new' | 'undo' | 'save-level' | 'load-level' | 'test-level' | 'menu' | 'element' | 'theme';
    };
    /**
     * Desktop editor button: a widget, button (ui/docs/desktop-editor-button.ui.json)
     *
     * Properties:
     *   - `label`: text, default ""
     *   - `selected`: yesno, default false
     * Events: `<id>`
     * Code areas: none
     * Refs: none
     */
    'desktop-editor-button': {
      props: { label: string | { loc: string } | LocText; selected: boolean };
      areas: never;
      refs: never;
    };
    /**
     * Desktop grid row: a widget (ui/docs/desktop-grid-row.ui.json)
     *
     * Properties:
     *   - `cells`: list of desktop-cell
     * Events: `<id>: press (<item>)`
     * Code areas: none
     * Refs: none
     */
    'desktop-grid-row': {
      props: { cells: readonly { key: string; image?: string; label?: string | { loc: string } | LocText }[] };
      areas: never;
      refs: never;
    };
    /**
     * Desktop heading: a widget (ui/docs/desktop-heading.ui.json)
     *
     * Properties:
     *   - `title`: text, default ""
     *   - `subtitle`: text, default ""
     * Events: none
     * Code areas: none
     * Refs: none
     */
    'desktop-heading': {
      props: { title: string | { loc: string } | LocText; subtitle: string | { loc: string } | LocText };
      areas: never;
      refs: never;
    };
    /**
     * Desktop hud: a view, screen (ui/docs/desktop-hud.ui.json)
     *
     * Properties:
     *   - `name`: text, default ""
     *   - `score`: text, default ""
     *   - `round`: text, default ""
     *   - `high`: text, default ""
     *   - `lives`: text, default ""
     *   - `enemies`: text, default ""
     *   - `banner`: text, default ""
     *   - `hint`: text, default ""
     *   - `showBanner`: yesno, default false
     *   - `clear`: yesno, default false
     *   - `freeze`: text, default ""
     * Events: none
     * Code areas: none
     * Refs: none
     */
    'desktop-hud': {
      props: { name: string | { loc: string } | LocText; score: string | { loc: string } | LocText; round: string | { loc: string } | LocText; high: string | { loc: string } | LocText; lives: string | { loc: string } | LocText; enemies: string | { loc: string } | LocText; banner: string | { loc: string } | LocText; hint: string | { loc: string } | LocText; showBanner: boolean; clear: boolean; freeze: string | { loc: string } | LocText };
      areas: never;
      refs: never;
    };
    /**
     * Desktop key button: a widget, button (ui/docs/desktop-key-button.ui.json)
     *
     * Properties:
     *   - `label`: text, default ""
     *   - `selected`: yesno, default false
     * Events: `<id>`
     * Code areas: none
     * Refs: none
     */
    'desktop-key-button': {
      props: { label: string | { loc: string } | LocText; selected: boolean };
      areas: never;
      refs: never;
    };
    /**
     * Desktop key row: a widget (ui/docs/desktop-key-row.ui.json)
     *
     * Properties:
     *   - `keys`: list of desktop-key-button
     * Events: `<id>: press (<item>)`
     * Code areas: none
     * Refs: none
     */
    'desktop-key-row': {
      props: { keys: readonly { key: string; label?: string | { loc: string } | LocText; selected?: boolean }[] };
      areas: never;
      refs: never;
    };
    /**
     * Desktop menu: a view, screen (ui/docs/desktop-menu.ui.json)
     *
     * Properties:
     *   - `subtitle`: text, default ""
     *   - `startSelected`: yesno, default false
     *   - `profilesSelected`: yesno, default false
     *   - `scoresSelected`: yesno, default false
     *   - `editorSelected`: yesno, default false
     *   - `settingsSelected`: yesno, default false
     *   - `helpSelected`: yesno, default false
     *   - `creditsSelected`: yesno, default false
     *   - `quitSelected`: yesno, default false
     *   - `titleMode`: yesno, default false
     *   - `promptVisible`: yesno, default true
     *   - `status`: text, default ""
     *   - `showStatus`: yesno, default false
     * Events: `start`, `profiles`, `scores`, `editor`, `settings`, `help`, `credits`, `quit`
     * Code areas: `bubbles`, `dragons`
     * Refs: `start`, `profiles`, `scores`, `editor`, `settings`, `help`, `credits`, `quit`
     */
    'desktop-menu': {
      props: { subtitle: string | { loc: string } | LocText; startSelected: boolean; profilesSelected: boolean; scoresSelected: boolean; editorSelected: boolean; settingsSelected: boolean; helpSelected: boolean; creditsSelected: boolean; quitSelected: boolean; titleMode: boolean; promptVisible: boolean; status: string | { loc: string } | LocText; showStatus: boolean };
      areas: 'bubbles' | 'dragons';
      refs: 'start' | 'profiles' | 'scores' | 'editor' | 'settings' | 'help' | 'credits' | 'quit';
    };
    /**
     * Desktop profile row: a widget (ui/docs/desktop-profile-row.ui.json)
     *
     * Properties:
     *   - `label`: text, default ""
     *   - `avatar`: image, default "ui/sprites/star"
     *   - `selected`: yesno, default false
     * Events: `<id>: pick`
     * Code areas: none
     * Refs: `pick`
     */
    'desktop-profile-row': {
      props: { label: string | { loc: string } | LocText; avatar: string; selected: boolean };
      areas: never;
      refs: 'pick';
    };
    /**
     * Desktop score row: a widget (ui/docs/desktop-score-row.ui.json)
     *
     * Properties:
     *   - `name`: text, default ""
     *   - `score`: text, default ""
     *   - `round`: text, default ""
     *   - `record`: text, default ""
     * Events: none
     * Code areas: none
     * Refs: none
     */
    'desktop-score-row': {
      props: { name: string | { loc: string } | LocText; score: string | { loc: string } | LocText; round: string | { loc: string } | LocText; record: string | { loc: string } | LocText };
      areas: never;
      refs: never;
    };
    /**
     * Desktop shell: a view, screen (ui/docs/desktop-shell.ui.json)
     *
     * Properties:
     *   - `title`: text, default "BUBBLE BOBBLE"
     *   - `subtitle`: text, default ""
     *   - `body`: text, default ""
     *   - `status`: text, default ""
     *   - `buttons`: list of desktop-button
     *   - `rows`: list of desktop-grid-row
     *   - `logo`: yesno, default false
     *   - `keys`: list of desktop-key-button
     *   - `page`: enum title | menu | profiles | new-profile | settings | scores | help | credits | play | pause | result | editor, default "title"
     * Events: `press (<item>)`, `press (<item>) (<item>)`
     * Code areas: none
     * Refs: none
     */
    'desktop-shell': {
      props: { title: string | { loc: string } | LocText; subtitle: string | { loc: string } | LocText; body: string | { loc: string } | LocText; status: string | { loc: string } | LocText; buttons: readonly { key: string; label?: string | { loc: string } | LocText; selected?: boolean }[]; rows: readonly { key: string; cells?: readonly { key: string; image?: string; label?: string | { loc: string } | LocText }[] }[]; logo: boolean; keys: readonly { key: string; label?: string | { loc: string } | LocText; selected?: boolean }[]; page: 'title' | 'menu' | 'profiles' | 'new-profile' | 'settings' | 'scores' | 'help' | 'credits' | 'play' | 'pause' | 'result' | 'editor' };
      areas: never;
      refs: never;
    };
    /**
     * Desktop small button: a widget, button (ui/docs/desktop-small-button.ui.json)
     *
     * Properties:
     *   - `label`: text, default ""
     *   - `selected`: yesno, default false
     * Events: `<id>`
     * Code areas: none
     * Refs: none
     */
    'desktop-small-button': {
      props: { label: string | { loc: string } | LocText; selected: boolean };
      areas: never;
      refs: never;
    };
  }
}
