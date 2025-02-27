import fs from "fs";
import path from "path";
import YAML from "yaml";
import dotenv from "dotenv";
import { NodeHtmlMarkdown } from "node-html-markdown";
import {
  isDirectory,
  readFileWithFallback,
  readJsonFromFile,
  readContentPage,
  readConfigFile,
} from "./helpers/file-helper.js";
import {
  updateDeeplyNestedObjectsAndReturnTranslations,
  updateDeeplyNestedTranslationObjects,
} from "./helpers/block-walkers.js";

dotenv.config();
const nhm = new NodeHtmlMarkdown(
  /* options (optional) */ { emDelimiter: "*" },
  /* customTransformers (optional) */ undefined,
  /* customCodeBlockTranslators (optional) */ undefined
);

(async () => {
  const configData = await readConfigFile("./rosey/config.yaml");
  // const contentDirPath = "./src/content/pages/"; // The content dir of .md pages to sync data files to
  const contentDirPath = configData.visual_editing.content_directory; // TODO: Test whether the omitted pages affects anything - The content dir of .md pages to sync data files to
  console.log({ contentDirPath });
  // const dataFilesDirPath = "./rosey/translations";
  const dataFilesDirPath = configData.rosey_paths.translations_dir_path;
  // const baseJsonFile = "./rosey/base.json";
  const baseJsonFile = configData.rosey_paths.rosey_base_file_path;
  // const roseyLocalesDirPath = "./rosey/locales/";
  const roseyLocalesDirPath = configData.rosey_paths.locales_dir_path;
  const locales = configData.locales;
  const excludedContentFiles = configData.visual_editing.excluded_files;
  const baseJsonData = await readJsonFromFile(baseJsonFile);
  const baseJsonKeys = Object.keys(baseJsonData.keys);
  const translationsDirFiles = await fs.promises.readdir(dataFilesDirPath);
  const firstTranslationDirPath = path.join(
    dataFilesDirPath,
    translationsDirFiles[0]
  );
  const dataFilePageNames = await fs.promises.readdir(firstTranslationDirPath, {
    recursive: true,
  });
  const contentDirectoryPageNames = await fs.promises.readdir(contentDirPath, {
    recursive: true,
  });

  const contentDirectoryPageNamesFiltered = [];
  contentDirectoryPageNames.map((fileName) => {
    if (excludedContentFiles.includes(fileName)) {
      return;
    } else {
      contentDirectoryPageNamesFiltered.push(fileName);
    }
  });

  // Get the data from the last builds locales files before we start our page loop
  let localesData = {};
  await Promise.all(
    locales.map(async (locale) => {
      const localeFilePath = path.join(roseyLocalesDirPath, `${locale}.json`);

      const localeTranslationDataRaw =
        await readFileWithFallback(localeFilePath);

      if (!localeTranslationDataRaw) {
        localesData[locale] = {};
        return;
      } else {
        localesData[locale] = YAML.parse(localeTranslationDataRaw);
        return;
      }
    })
  );

  // Loop through all the pages
  await Promise.all(
    dataFilePageNames.map(async (pageFileName) => {
      // Find the corresponding page content for each page we're looping through in our base.json if its visually editable
      const pageFilePath = path.join(firstTranslationDirPath, pageFileName);

      let pageTranslationData = {};

      if (await isDirectory(pageFilePath)) {
        console.log(`${pageFilePath} is dir - no sync needed`);
        return;
      }

      await Promise.all(
        locales.map(async (locale) => {
          const translationPageFilePath = path.join(
            dataFilesDirPath,
            locale,
            pageFileName
          );

          const pageTranslationDataRaw = await readFileWithFallback(
            translationPageFilePath
          );
          pageTranslationData[locale] = YAML.parse(pageTranslationDataRaw);
        })
      );

      // If page is visually editable, get the page's contents
      let pageNameMd = pageFileName
        .replace(".yaml", ".md")
        .replace("home", "index");
      const isPageVisuallyEditable = () => {
        if (contentDirectoryPageNamesFiltered.includes(pageNameMd)) {
          return true;
        }
        if (contentDirectoryPageNamesFiltered.includes(`${pageNameMd}x`)) {
          pageNameMd = `${pageNameMd}x`;
          return true;
        }
        if (
          !pageFileName.includes("/") &&
          contentDirectoryPageNamesFiltered.includes(`pages/${pageNameMd}`)
        ) {
          pageNameMd = `pages/${pageNameMd}`;
          return true;
        }
        return false;
      };

      console.log({ pageNameMd });
      console.log(isPageVisuallyEditable());
      console.log({ contentDirectoryPageNamesFiltered });
      if (!isPageVisuallyEditable()) {
        return;
      }
      const contentPageFilePath = path.join(contentDirPath, pageNameMd);
      const { frontmatter, bodyContent } =
        await readContentPage(contentPageFilePath);

      // Check for any translations to update in frontmatter, and any new ones to sync back to data file
      // Loop through all the Rosey keys and check each content block on the page
      let newTranslationsToWriteToLocaleDataFiles = {};
      baseJsonKeys.map((translationKey) => {
        const translationOriginalInMarkdown = nhm.translate(
          baseJsonData.keys[translationKey].original.trim()
        );

        // If this page is visually editable and has content blocks
        // Find the corresponding translation and add the translated value from the data file to the content block
        // Once we've looped over it's blocks we can write the file with the new transformed frontmatter
        if (isPageVisuallyEditable()) {
          // This will return a value if it finds a new translation to write to data file,
          // Otherwise undefined and there is nothing to write to data file
          const newTranslations =
            updateDeeplyNestedObjectsAndReturnTranslations(
              frontmatter,
              locales,
              translationOriginalInMarkdown,
              pageTranslationData,
              baseJsonData,
              localesData
            );

          if (newTranslations) {
            newTranslationsToWriteToLocaleDataFiles[translationKey] =
              newTranslations;
          }
        }
      });

      // Check for new translations from the frontmatter to write back to data file
      const newTranslationsObjKeys = Object.keys(
        newTranslationsToWriteToLocaleDataFiles
      );

      if (newTranslationsObjKeys.length) {
        let keysToChangeByLocales = {};

        // Create an empty array for each locale
        locales.forEach((locale) => {
          keysToChangeByLocales[locale] = {};
        });

        // Loop through the keys we need to change and add to obj grouping changes by locale
        newTranslationsObjKeys.forEach((objKey) => {
          const translationObject =
            newTranslationsToWriteToLocaleDataFiles[objKey];
          const translationObjectLocaleKeys = Object.keys(translationObject);

          // For each translation object, loop through the keys which could have changes in multiple locales
          translationObjectLocaleKeys.forEach((localeKey) => {
            const localeTranslationObject = translationObject[localeKey];

            const keysInLocale = Object.keys(localeTranslationObject);

            keysInLocale.forEach((translationKey) => {
              const translationToWrite =
                localeTranslationObject[translationKey];

              keysToChangeByLocales[localeKey][translationKey] =
                translationToWrite;
            });
          });
        });

        // Loop through each locale and update the corresponding data file
        const keysToChangeByLocalesKeys = Object.keys(keysToChangeByLocales);
        await Promise.all(
          keysToChangeByLocalesKeys.map(async (localeKey) => {
            // Get the translations we need for this locale
            const translationsToWriteByLocale =
              keysToChangeByLocales[localeKey];

            const translationsToWriteByLocaleKeys = Object.keys(
              translationsToWriteByLocale
            );

            if (!translationsToWriteByLocaleKeys.length) {
              return;
            }

            // Get the locale data files page contents
            const dataFilePagePath = path.join(
              dataFilesDirPath,
              localeKey,
              pageFileName
            );

            // Parse that page data, loop through the locale array of keys to change and
            // Replace any translations in the data file at that key
            const dataFileBuffer = await fs.promises.readFile(dataFilePagePath);
            const dataFileRaw = dataFileBuffer.toString("utf-8");
            const dataFileContents = YAML.parse(dataFileRaw);
            translationsToWriteByLocaleKeys.forEach((key) => {
              dataFileContents[key] = translationsToWriteByLocale[key];
            });
            await fs.promises.writeFile(
              dataFilePagePath,
              YAML.stringify(dataFileContents)
            );
          })
        );

        // Now that data page is updated from the frontmatter
        // Run through the content blocks looking for duplicates and overwrite them
        let newPageTranslationData = {};

        if (await isDirectory(pageFilePath)) {
          console.log(`${pageFilePath} is dir - no sync needed`);
          return;
        }

        await Promise.all(
          locales.map(async (locale) => {
            const translationPageFilePath = path.join(
              dataFilesDirPath,
              locale,
              pageFileName
            );

            const pageTranslationDataRaw = await readFileWithFallback(
              translationPageFilePath
            );
            newPageTranslationData[locale] = YAML.parse(pageTranslationDataRaw);
          })
        );

        baseJsonKeys.map((translationKey) => {
          const translationOriginalInMarkdown = nhm.translate(
            baseJsonData.keys[translationKey].original.trim()
          );

          // If this page is visually editable and has content blocks
          // Find the corresponding translation and add the translated value from the data file to the content block
          // Once we've looped over it's blocks we can write the file with the new transformed frontmatter
          if (isPageVisuallyEditable()) {
            // This will return a value if it finds a new translation to write to data file,
            // Otherwise undefined and there is nothing to write to data file

            updateDeeplyNestedTranslationObjects(
              frontmatter,
              locales,
              translationOriginalInMarkdown,
              newPageTranslationData
            );
          }
        });
      }
      // Combine frontmatter and body content in the correct way then write the file back to src/content/pages
      const pageToWrite = [
        "---",
        YAML.stringify(frontmatter),
        "---",
        bodyContent?.trim(),
      ].join("\n");

      await fs.promises.writeFile(contentPageFilePath, pageToWrite);
      console.log("✅✅ " + contentPageFilePath + " updated succesfully");
    })
  );
})();
