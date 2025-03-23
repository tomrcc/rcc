# Rosey CloudCannon Connector

## Getting started

1. Create two sites using a staging -> production publishing workflow on CloudCannon
2. Add the env variable `SYNC_PATHS=/rosey/` to your staging site. Add your Smartling api key as `DEV_USER_SECRET=YOUR_SECRET_API_KEY_HERE` if you have a Smartling account set up for auto translations.
3. Add the env variable `ROSEYPROD=true` to your production site.
4. Add the `rosey` and `rosey-connector` directories to your project. In the `rosey/config.yml` add at least one language code to the `locales` array, and add your staging cloudvent url to the `base_url` key.
5. Add a `.cloudcannon` directory in the root of your project if you don't have one already. Add a `postbuild` file to it if you don't already have one, replacing `dist` with the output directory of your project. For example, for a default 11ty bui.d, you would replace `dist` with `_site`.


`.cloudcannon/postbuild`:


```bash
#!/usr/bin/env bash

npx @bookshop/generate

if [[ $ROSEYPROD != "true" ]];
then
  npx rosey generate --source dist
  node rosey-connector/roseyCloudCannonConnector.js
fi

if [[ $ROSEYPROD == "true" ]];
then
  echo "Translating site with Rosey"
  # By default, Rosey will place the default language under a language code, e.g. /en/index.html, and will generate a redirect file at /index.html.
  # By setting the flag --default-language-at-root, Rosey will output the default language at the root path, e.g. /index.html.
  # By setting the flag --default-language-at-root, Rosey will not generate any redirect pages.

  # We only want this to run on our production site, as it can interfere with CloudCannon CMS's visual editor
  # There's a little bit of shuffling around here to ensure the translated site ends up where CloudCannon picks up your site
  mv ./dist ./untranslated_site                  
  npx rosey build --source untranslated_site --dest dist 
fi

```


6. Install the following node packages in your project:

``` json
"dependencies": {
  "markdown-it": "^13.0.1",
  "node-html-markdown": "^1.3.0",
  "rosey": "^2.3.3",
  "slugify": "^1.6.6",
  "yaml": "^2.4.2",
  "smartling-api-sdk-nodejs": "^2.11.0",
  "dotenv": "^16.4.5",
}

Add these if you are using Astro
```json
  "dependencies": {
    "unist-util-visit": "^5.0.0",
    "hast-util-from-html-isomorphic": "^2.0.0",
  }
```

7. Add a translations collection to your `cloudcannon.config.yml`. If you have a `collection_groups:` key, remember to add `translations` to that. If your site is nested in a subdir, then you'll need to remove your `source` key, and manually add the subdir to each path that needs it. `rosey` does not need the prefix of the subdir since it lives in the root. Schema paths are not affected by the `source` key anyway, so do not need updating.

```yml
collections_config:
  translations:
    path: rosey
    icon: translate
    disable_url: true
    disable_add: true
    disable_add_folder: true
    disable_file_actions: false
    glob:
      - config.yaml
      - 'translations/**'
    _inputs:
      urlTranslation:
        type: text
        comment: Provide a translation for the URL that Rosey will build this page at.

```

8. This project is written with ESM syntax. If your project is in CJS, you may need to update your project, or the `rosey-connector` files. 

To change your project to ESM, make sure your package.json is `"type": "module"`, and either change any CJS files to .cjs extension, or refactor to ESM syntax. 

Alternatively it may be easier to change the .js files in `rosey-connector` to .mjs, and update any .js imports in those files.

9. After your next build in CC, You should see empty translations files. Start tagging your layouts and components with data-rosey tags to see something appear in here to translate.

An example tag in 11ty may look like:
data-rosey="{{ heading.heading_text | slugify }}"

```liquid
<h1 class="heading" data-rosey="{{ heading.heading_text | slugify }}">{{ heading.heading_text }}</h1>
```

11ty has the slugify universal filter, which means we can slugify the content and use that as the translation key. If you are using an SSG that doesn't have the slugify filter built in, you can roll your own. An example has been provided in  `rosey-connector/helpers/component-helper.js`.

For markdown body content, we need to extend the SSG's built in markdown processing. A Jekyll plugin has been provided, as well as an Astro plugin. These plugins tag markdown that is turned into block level html elements, with an html attribute `data-rosey="an-example-phrase-for-translation"`. Content that is processed through the SSGs native markdown processing in templating(eg. Jekylls `markdownify`) will also need the same treatment, where we break the larger (perhaps many paragraph) phrase into individual block level elements.