# Astro Rosey Starter

A starting point for developers looking to build a multilingual website with [Astro](https://astro.build/) and [Rosey](https://rosey.app/), using [Bookshop](https://github.com/CloudCannon/bookshop)'s component-based approach to building and editing sites in CloudCannon.

This starter comes with a translation workflow set up in CloudCannon's CMS with Rosey and Bookshop, to provide a UI for non-technical editors and translators to control a site's content and translations. CloudCannon is a git-based CMS, meaning all translations and content changes will be saved in your git history. 

Rosey is an open source translation workflow for static sites. We run custom `node fs` scripts in the site's postbuild to generate inputs that a user can enter translations into. Rosey then uses the provided translations to generate a multilingual site.

An integration with Smartling is provided to use AI to provide initial translations, that your editors can QA rather than having to manually type out every translation manually. This requires a Smartling account, and project set up. Talk to CloudCannon's support team if you want to use this, and need assistance.

Create your own copy, and start creating your own components that editors can use in the CloudCannon CMS to build and maintain pages. Add `data-rosey` tags to text content that you want to be included in the translations. Build components with either `.jsx` or `.astro`.

To try to cut down on setup time this starter template also includes some commonly used [features](#other-features) in CloudCannon.

This template is aimed at helping developers build multilingual sites quickly or referencing how to migrate your existing SSG setup to use this workflow. If you are an editor looking for an already built template, have a look at [CloudCannon's templates page](https://cloudcannon.com/templates/).

## YouTube overview and setup instructions

[![Easily manage your multilingual Astro site in CloudCannon](https://img.youtube.com/vi/u5WittUT3Ts/0.jpg)](https://www.youtube.com/watch?v=u5WittUT3Ts)

## How it works

1. Rosey generates a base.json file from wherever it detects a `data-rosey=""` tag in your built site.
2. We run a script that creates translations files from this `base.json` file. For each locale listed in your `LOCALES` in the `rosey/config.yaml` file, a directory is created in the translations directory. Inside these locale directories are the site's pages with an input for each mention of a `data-rosey` tag on the page.
3. Editors can see an input for each translation in the CloudCannon UI, and can enter a translated value. Translators can see the original phrase to translate as a label or context dropdown, and links to see the original phrase highlighted in context on the page.
4. After entering translations and saving, another script runs in our postbuild to generate the [locale files that Rosey expects](https://rosey.app/docs/#creating-locale-files) from our translations. All the files that are changed or generated are synced back to our git repository.
5. With these new translations, and Rosey files we can push to our main branch (production site).
6. As part of the build on the main branch, Rosey uses these files to generate a multilingual site, building the pages for each locale. Rosey also builds a redirect for visitors, detecting a site visitors default browser locale on visiting the main url of the site, and redirecting them appropriately.

A folder with all of the original site's data-rosey tag mentions, split by page, will be generated from the locale codes (eg. es, es-es) in the Rosey config `rosey/config.yaml` file. You can enter whatever locale code version you like (`xx` or `xx-XX`), and a version of your site will be built at that URL.

On each page with a translation, an input is generated which allows editors to define a translated URL for that page to build at, and be visited at.

CloudCannon offers migration services if needed for larger SSG projects wanting help migrating to a new multilingual workflow - get in touch with our [web services team](https://cloudcannon.com/web-services/) if you'd like to discuss this further.

## Requirements

- A CloudCannon organisation with access to [publishing workflows](https://cloudcannon.com/pricing/).

## Why is this useful?

This approach separates your content and your layouts. You can change the layout and styling in one place, and have those changes reflected across all the languages you translate to.

You provide the original content in your primary/default language, your translator completes the translations within the CMS, and Rosey does the rest.

Rosey automatically redirects all site visitors to the locale that matches their browser language settings. If their locale is not supported, Rosey redirects them to the default version.

### Example

An editor adds a new left-right block (component) to a page. The component could have many additional things to set up besides just written content (such as style or spacing choices).

Without this workflow, chances are you're using a traditional split-by-directory approach for maintaining a multilingual site - where a separate version of each page for each language is maintained. The editor would have to manually add this left-right component across all those pages for each language. The editor will have to set up everything not directly content related, as well as enter the translations.

With Rosey: the left-right component is added in the English version, and for each locale we have defined in our environment variables, a translation entry will appear for an editor to fill out. The translator only has to enter the translated content, and Rosey will handle the rest.

## Getting Started

1. To start using this template, go to the [GitHub repository](https://github.com/CloudCannon/rosey-astro/), and click `Use this template` to make your own copy. Copy both branches - `staging` and `main`.
2. Build the site on CloudCannon using your `staging` branch. Set an environment variable of `TRANSLATE=false`. If using Smartling for automatic machine translations, add your API key `DEV_USER_SECRET=your-api-key-here`.
3. On CloudCannon, build another site - your production site - from your main branch.
4. On your production site, change the environment variable `TRANSLATE=true`. This should be the only environment variable you need on that site. You can delete the other initially populated ones that belong on staging.
5. On the staging site fill in the `rosey/config.yaml` file. Enter the locales needed for your project. Enter your staging url as the Base Url. CloudCannon should generate one of these for you for your 'live site preview'. If using Smartling machine translations, fill in your Smartling account and project details. Ensure to keep Smartling disabled until you are ready and have set up your Smartling account. **Smartling machine translations cost money, so take care setting this part up**.
6. Save, let the build finish, and refresh the page.
7. In translations you can see new folders for the locales you entered. Delete the placeholder ones if not used.
8. Enter a translation, save and wait for the build to finish, then publish to your production site.
9. Navigate to the adjective-noun.cloudvent.net address for your production site live site preview, and see Rosey redirect to your default browser language. You can open a different browser, change the default language settings, and go to the site to test it.
10. You should see your entered translation on the page you entered a translation for on your staging site.
11. Start replacing the components, layouts, and content of the site with your own.

## Adding this workflow to an existing site

1. Ensure you have a staging -> production publishing workflow set up on CloudCannon.
2. Set up environment variables on each. `TRANSLATE=true` on production, and `TRANSLATE=false` on staging. If using Smartling automatic machine translations, add the environment variable `DEV_USER_SECRET=your-api-key-here`.
3. Add /rosey/ folder.
4. Add and install the required packages to dev dependencies
  ```json
      "markdown-it": "^14.1.0",
      "file-system": "^2.2.2",
      "node-html-markdown": "^1.3.0",
      "rosey": "^2.0.5",
      "slugify": "^1.6.6",
      "yaml": "^2.4.2",
      "netlify-cli": "^17.20.1",
      "diff": "^5.2.0",
  ```
5. Add translations collection to cloudcannon.config.
6. Add commands to postbuild.
7. Change the `locales` and `base_url` in your `rosey/config.yaml` file to what you need for your site.
8. Set up Smartling configuration, if needed. 
8. Add Rosey tags to html tags to translate.

## Adding Translations

Add a tag of `data-rosey="example-key"` to an HTML element containing text, with a key for Rosey to use to keep track of that piece of text content.

Tag values need to be unique for Rosey to keep track of what translations go where, so you will need to generate an id as demonstrated in this template. We can use a `generateRoseyId()` function to slugify the content of the translation and use that as the Rosey key. See [below](#bookshop) for more information.

Once we rebuild the site, we can see inputs for our translations on `staging`. Once we enter a translation, save and wait for the build to finish, we can publish to our `main` branch, and Rosey will our translations to generate a multilingual site for us.

To create your own components that add inputs to our translation files, add a `data-rosey=""` tag, following a format similar to the one provided in the placeholder components.

## Environment Variables

The `SYNC_PATHS=/rosey/` environment variable tells CloudCannon to sync the generated data in the `/rosey/` directory from our postbuild back to the source repository. We only want this to happen on staging.

The `TRANSLATE=true` environment variable tells Rosey to generate a site from the data in the locales folder.
Only set this to `true` on the production site. We also don't run the generate scripts if `TRANSLATE=true`, as the locales we generate the multilingual site from are already in place, meaning we don't need to run it again. It has the added bonus of meaning we only need the one environment variable on our production site.
Setting this to `true` on our staging site will interfere with CloudCannon's UI, and means we can't enter translations, or edit pages. This is why we need a staging to production publishing workflow.

## Local Development & Testing

To run site locally:

```bash
npm i
npm start
```

To run Rosey locally (handy for debugging):

```bash
npm run build
./.cloudcannon/postbuild
```

If you get a permission error for running the postbuild locally, you can try changing the permissions for that file with:

```bash
chmod u+x ./.cloudcannon/postbuild
```

### Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |
