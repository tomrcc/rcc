- Option to put everything into one file instead of split by pages - to replace the old i18n workflow
- Add .mjs to .js files in case the site transferring to isn't using type: module in package.json
  - Test it works with type set and not
- Make rosey cloudcannon.config collection the whole rosey folder and exclude 
  - locales/
  - smartling-translations/
  - utils/
  - base.json
  - base.urls.json
  - checks.json
  - outgoing-smartling-translations.json
  - source.json
- Add generation of shared phrases translation file
  - Can keep them on their individual pages and use the existing overwrite workflow to keep them in sync
- Add to readme about
  - Initial set up
  - Using in place of i18n
  - Transferring to an existing site
  - Link to the features on Astro starter for extra features
  - Using the id functions
  - How to separate unwanted duplicate keys eg. same value on separate pages
  - How long form content works with block level element splitting (including snippets)
  - Using smartling
  - Debugging locally (include setting up local .env and gitignoring it)
- Chase up CC update for mistaken 'Awaiting page translations'
- Chase up CC update for removing files with unlink or rm (fs.promises)
- Record a new intro youtube video
- npm audit
- Tests
- Feat request video for data in the visual editor

## High Level

- Get RCC to a polished state
- Can we keep it all on one repo
    - Add SSG specific things to an adapters folder
    - Replace `dist` with an output folder set in the config
- Save a separate repo for visual editing previews that acts as a PoC
    - Delete the other iterations after we have RCC and visual editor PoC
- Eventually data files can be edited from the visual editor and affect the components dependent on them removing the need for syncing between data files and content pages
- Set up alternative multilingual options
    - Create content that helps decide what to use when using CC for multilingual

## Todo

- Remove staging → prod stuff
    - It works with just one site post unified config
- Better logs
    
    ![Screenshot 2025-03-13 at 9.17.52 AM.png](attachment:f04ab87d-a097-4504-b4ba-bb5a129b7a5a:Screenshot_2025-03-13_at_9.17.52_AM.png)
    
    ![Screenshot 2025-03-13 at 9.18.02 AM.png](attachment:b6b05fa8-da07-48a9-8b5a-c5e8d2ca06c9:Screenshot_2025-03-13_at_9.18.02_AM.png)
    
- Move the rest of the postbuild to a single file so we can read from config
    - output dir - use exec_sync to run the rosey generate script with the dir set in the config
    - can run the translate step in here as well after reading the env variable
- Option to put everything into one file instead of split by pages - to replace the old i18n workflow
- Add .mjs to .js files in case the site transferring to isn't using type: module in package.json
    - Test it works with type set and not
- Make rosey cloudcannon.config collection the whole rosey folder and exclude
    - locales/
    - smartling-translations/
    - utils/
    - base.json
    - base.urls.json
    - checks.json
    - outgoing-smartling-translations.json
    - source.json
- Add generation of shared phrases translation file
    - Can keep them on their individual pages and use the existing overwrite workflow to keep them in sync
- Add to readme about
    - Initial set up
    - Using in place of i18n
    - Transferring to an existing site
    - Link to the features on Astro starter for extra features
    - Using the id functions
    - How to separate unwanted duplicate keys eg. same value on separate pages
    - How long form content works with block level element splitting (including snippets)
    - Using smartling
    - Debugging locally (include setting up local .env and gitignoring it)
- Chase up CC update for mistaken 'Awaiting page translations'
- Chase up CC update for removing files with unlink or rm (fs.promises)
    - If never possible add note about running in local to delete old pages(files) or deleting manually
    - Or use an ‘archive’ folder to move these pages to
- Record a new intro youtube video
- npm audit
- Tests
- Feat request video for data in the visual editor

## Alternative multilingual options

*Set up other options to show why we’d use RCC in the first place, and for people where RCC is overkill*

- Set up a split-by-dir with complex components to show why it’s annoying to maintain different dirs
- Set up a simple version of RCC where we just directly edit the locales.json after writing to it from base.json as a more direct replacement for an i18n file

## Remember in Readme

- Adding a new component
- Block level elements in long-form text
- Generating ids
- Duplicate entries

TODO: add language picker using popover targets
<button popovertarget="locales-list" popovertargetaction="toggle" id="locales-toggle">
  Locales
</button>

<div id="locales-list" popover="auto">
  <div class="locales-list-wrapper">
  <a href="/fr-FR{{ page.url }}">French</a>
  <a href="/de-DE{{ page.url }}">German</a>
  <a href="{{ page.url }}">English</a>
  </div>
</div>

<style>
  /* Button styling */
  .locales-list-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
  }
  #locales-toggle {
    width: fit-content;
    padding: 8px;
    border-radius: 6px;
    display: flex;
    justify-content: space-around;
    box-shadow: 1px 1px 3px #999;
  }
  #locales-toggle:hover,
  #locales-toggle:focus {
    background: #ccc;
  }
  #locales-toggle:active {
    box-shadow: inset 1px 1px 2px #333, inset -1px -1px 2px #eee;
  }

  /* Styling auto popovers */
  [popover="auto"] {
    inset: unset;
    position: absolute;
    top: calc(anchor(bottom) + 20px);
    justify-self: anchor-center;
    margin: 0;
    box-shadow: 1px 1px 3px #999;
    border-radius: 6px;
  }
  [popover="auto"] a {
    border-radius: 6px;
    width: 100%;
    padding: 8px 16px;
    line-height: 1.5;
    display: flex;
    align-items: center;
    justify-content: left;
  }
  [popover="auto"] a:hover,
  [popover="auto"] a:focus {
    background: #ccc;
  }
  [popover="auto"] a:active {
    box-shadow: inset 1px 1px 2px #333, inset -1px -1px 2px #eee;
  }
</style>