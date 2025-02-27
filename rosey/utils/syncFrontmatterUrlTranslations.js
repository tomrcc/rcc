import fs from "fs";
import path from "path";
import YAML from "yaml";
import dotenv from "dotenv";
import {
  isDirectory,
  readFileWithFallback,
  readJsonFromFile,
  readContentPage,
  readConfigFile,
} from "./helpers/file-helper.js";

dotenv.config();

(async () => {
  const configData = await readConfigFile("./rosey/config.yaml");

  // const localesDir = "./rosey/locales";
  const localesDir = configData.rosey_paths.locales_dir_path;
  // const translationsDir = "./rosey/translations";
  const translationsDir = configData.rosey_paths.translations_dir_path;
  // const contentDirPath = "./src/content/"; // The content dir of .md pages to sync data files to
  const contentDirPath = configData.visual_editing.content_directory;
  // const excludedContentPages = ["config.ts"];
  const excludedContentPages = configData.visual_editing.excluded_files;
  // const locales = process.env.LOCALES?.split(",");
  const locales = configData.locales;
  // Get all pages frontmatter
  const pagesFilePathsWithDirs = await fs.promises.readdir(contentDirPath, {
    recursive: true,
  });

  const pagesFilePaths = [];

  // Filter out non-pages/excluded pages
  await Promise.all(
    pagesFilePathsWithDirs?.map(async (file) => {
      const pageFilePath = path.join(contentDirPath, file);
      const filePathIsDirectory = await isDirectory(pageFilePath);
      if (excludedContentPages.includes(file) || filePathIsDirectory) {
        return;
      } else {
        return pagesFilePaths.push(file);
      }
    })
  );

  await Promise.all(
    pagesFilePaths.map(async (file) => {
      const pageFilePath = path.join(contentDirPath, file);
      const { frontmatter, bodyContent } = await readContentPage(pageFilePath);

      // See if there's a translations obj at the top lvl of the page which contains locales_url
      const frontmatterTranslations = frontmatter.translations;
      const isTranslationsConfigObj =
        frontmatterTranslations && typeof frontmatterTranslations === "object";

      if (!isTranslationsConfigObj) {
        return;
      }

      const translationsConfigObjKeys = Object.keys(frontmatterTranslations);

      const urlsToWriteToPage = [];
      await Promise.all(
        locales.map(async (locale) => {
          // Check it's the right object
          const localeUrlKey = `url_translation_${locale.replace("-", "_")}`;
          if (
            translationsConfigObjKeys &&
            translationsConfigObjKeys.includes(localeUrlKey)
          ) {
            // Find the corresponding data file
            const translationsDirPath = path.join(translationsDir, locale);

            // Reformat content page name to be match its data file name
            const fileTranslationNameEquivalent = file
              .replace("pages/", "")
              .replace("index.md", "home.yaml")
              .replace(".mdx", ".yaml")
              .replace(".md", ".yaml");

            const translationFilePath = path.join(
              translationsDirPath,
              fileTranslationNameEquivalent
            );

            const translationFileDataRaw =
              await readFileWithFallback(translationFilePath);
            const translationFileData =
              translationFileDataRaw && YAML.parse(translationFileDataRaw);

            const localeUrlFilePath = path.join(
              localesDir,
              `${locale}.urls.json`
            );
            const localeUrlFileData = await readJsonFromFile(localeUrlFilePath);

            // Reformat content page name to match it's html name
            const fileNameHtmlEquivalent = file
              .replace("pages/", "")
              .replace("index.md", "index.html")
              .replace(".mdx", "/index.html")
              .replace(".md", "/index.html");

            const currentUrlInFrontmatter =
              frontmatterTranslations[localeUrlKey];
            const currentUrlInDataFile = translationFileData?.urlTranslation;
            const lastUrlTranslation =
              localeUrlFileData[fileNameHtmlEquivalent].value;
            if (
              currentUrlInDataFile !== lastUrlTranslation ||
              currentUrlInFrontmatter === "" ||
              currentUrlInFrontmatter === null
            ) {
              // Add to an array an obj to write to the content page after locales is finished
              urlsToWriteToPage.push({
                key: localeUrlKey,
                urlToWrite: currentUrlInDataFile,
              });
              // Theres no new url translation in the data file, so check for one in frontmatter
              // Write to data file if we detect a new translation in frontmatter
            } else if (currentUrlInFrontmatter !== lastUrlTranslation) {
              // Update urlTranslation to new url
              translationFileData.urlTranslation = currentUrlInFrontmatter;
              // Write the file back
              await fs.promises.writeFile(
                translationFilePath,
                YAML.stringify(translationFileData).trim()
              );
            }
          }
        })
      );
      // If there is a new translated url on the page write that to the data file
      if (urlsToWriteToPage.length) {
        let updatedFrontmatter = frontmatter;
        urlsToWriteToPage.map((urlToWriteObj) => {
          updatedFrontmatter.translations[urlToWriteObj.key] =
            urlToWriteObj.urlToWrite;
        });

        const newPageToWrite = [
          "---",
          YAML.stringify(updatedFrontmatter).trim(),
          "---",
          bodyContent.trim(),
        ].join("\n");

        await fs.promises.writeFile(pageFilePath, newPageToWrite);
      }
    })
  );
})();
