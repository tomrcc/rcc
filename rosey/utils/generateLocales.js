import fs from "fs";
import YAML from "yaml";
import markdownit from "markdown-it";
import path from "path";
import {
  isDirectory,
  readFileWithFallback,
  readConfigFile,
} from "./helpers/file-helper.js";
import dotenv from "dotenv";
const md = markdownit();
dotenv.config();

(async () => {
  const configData = await readConfigFile("./rosey/config.yaml");
  const locales = configData.locales;
  // Loop through locales
  for (let i = 0; i < locales.length; i++) {
    const locale = locales[i];

    try {
      await generateLocale(locale, configData);
    } catch (err) {
      console.error(`❌❌ Encountered an error translating ${locale}:`, err);
    }
  }
})();

// The generateLocales function runs on each separate locale
async function generateLocale(locale, configData) {
  // console.log(configData);
  const translationsDirPath = configData.rosey_paths.translations_dir_path;
  const localesDirPath = configData.rosey_paths.locales_dir_path;
  const excludedContentFiles = configData.visual_editing.excluded_files;
  const contentDirectory = configData.visual_editing.content_directory;
  const baseFile = await fs.promises.readFile(
    configData.rosey_paths.rosey_base_file_path
  );
  const baseFileData = JSON.parse(baseFile.toString("utf-8")).keys;
  const baseURLsFile = await fs.promises.readFile(
    configData.rosey_paths.rosey_base_urls_file_path
  );
  const baseURLFileData = JSON.parse(baseURLsFile.toString("utf-8")).keys;

  const localePath = path.join(localesDirPath, `${locale}.json`);
  const localeURLsPath = path.join(localesDirPath, `${locale}.urls.json`);
  const translationsLocalePath = path.join(translationsDirPath, locale);

  // Ensure directories exist
  console.log(`📂📂 ${translationsLocalePath} ensuring directory exists`);
  await fs.promises.mkdir(translationsLocalePath, { recursive: true });

  console.log(`📂📂 ${localesDirPath} ensuring directory exists`);
  await fs.promises.mkdir(localesDirPath, { recursive: true });

  const oldLocaleData = JSON.parse(
    await readFileWithFallback(localePath, "{}")
  );
  const oldURLsLocaleData = JSON.parse(
    await readFileWithFallback(localeURLsPath, "{}")
  );

  const translationsFiles = await fs.promises.readdir(translationsLocalePath, {
    recursive: true,
  });

  // - Look through all the pages on the site for translation frontmatter keys

  const contentPagesTranslationConfig = {
    "404.html": {},
  };
  const locales = configData.locales;
  locales.map((locale) => {
    const localeKeyName = locale.replace("-", "_");
    contentPagesTranslationConfig["404.html"][`translate_${localeKeyName}`];
  });
  const contentDirectoryFiles = await fs.promises.readdir(contentDirectory, {
    recursive: true,
  });

  await Promise.all(
    contentDirectoryFiles.map(async (file) => {
      const filePath = path.join(contentDirectory, file);
      if (
        !(await isDirectory(filePath)) &&
        !excludedContentFiles.includes(file)
      ) {
        // Check pages frontmatter to see if we should translate
        const fileRawData = await readFileWithFallback(filePath);
        const fileFrontmatter = YAML.parse(fileRawData.split("---")[1]);
        const pageTranslationsConfig = fileFrontmatter.translations ?? {};
        const fileAsHtmlName = file
          .replace("pages/", "")
          .replace("index.md", "index.html")
          .replace(".mdx", "/index.html")
          .replace(".md", "/index.html");
        contentPagesTranslationConfig[fileAsHtmlName] = pageTranslationsConfig;
      }
    })
  );

  // Loop through each file in the translations directory
  const localeDataEntries = {};
  await Promise.all(
    translationsFiles.map(async (filename) => {
      if (
        await isDirectory(
          getTranslationPath(locale, translationsDirPath, filename)
        )
      ) {
        return;
      }

      const response = await processTranslation(
        locale,
        filename,
        translationsDirPath,
        oldLocaleData,
        oldURLsLocaleData,
        baseFileData,
        baseURLFileData,
        contentPagesTranslationConfig
      );

      localeDataEntries[filename] = response;
    })
  );

  let localeData = {};
  let localeURLsData = {};
  let keysToUpdate = {};

  await Promise.all(
    Object.keys(localeDataEntries).map(async (filename) => {
      const { data, urlData } = localeDataEntries[filename];

      Object.keys(urlData).forEach((key) => {
        localeURLsData[key] = urlData[key];
      });

      Object.keys(data).forEach((key) => {
        if (!localeData[key] || data[key].isNewTranslation) {
          const isKeyStaticOrMarkdown =
            key.slice(0, 10).includes("static:") ||
            key.slice(0, 10).includes("markdown:");

          localeData[key] = {
            original: data[key].original,
            value:
              isKeyStaticOrMarkdown && data[key].isNewTranslation
                ? md.render(data[key].value)
                : data[key].value,
          };
        }

        if (data[key].isNewTranslation) {
          keysToUpdate[key] = data[key].value;
        }
      });
    })
  );

  await Promise.all(
    Object.keys(localeDataEntries).map(async (filename) => {
      const translationFilePath = getTranslationPath(
        locale,
        translationsDirPath,
        filename
      );
      const fileContents = await readFileWithFallback(translationFilePath, "");
      const data = YAML.parse(fileContents);

      let updatedKeys = [];
      Object.keys(keysToUpdate).forEach((key) => {
        if (data[key] || data[key] === "") {
          data[key] = keysToUpdate[key];
          updatedKeys = [key];
        }
      });

      if (updatedKeys.length > 0) {
        const yamlString = YAML.stringify(data);
        await fs.promises.writeFile(translationFilePath, yamlString);
        console.log(
          `✅ ${translationFilePath} succesfully updated duplicate keys: ${updatedKeys.join(
            ", "
          )}`
        );
      }
    })
  );

  // Write locales data
  await fs.promises.writeFile(
    localePath,
    JSON.stringify(localeData, null, "\t")
  );
  console.log(`✅✅ ${localePath} updated succesfully`);

  // Write locales URL data
  await fs.promises.writeFile(
    localeURLsPath,
    JSON.stringify(localeURLsData, null, "\t")
  );
  console.log(`✅✅ ${localeURLsPath} updated succesfully`);
}

function getTranslationPath(locale, translationsDirPath, translationFilename) {
  return path.join(translationsDirPath, locale, translationFilename);
}

function getTranslationHTMLFilename(translationFilename) {
  if (translationFilename === "404.yaml") {
    return "404.html";
  }

  if (translationFilename === "home.yaml") {
    return "index.html";
  }

  return translationFilename.replace(".yaml", "/index.html");
}

function processUrlTranslationKey(
  translationEntry,
  translationHTMLFilename,
  baseURLFileData,
  oldURLsLocaleData
) {
  if (!translationEntry) {
    return;
  }

  if (translationEntry !== oldURLsLocaleData[translationHTMLFilename]?.value) {
    console.log(`Detected a new URL translation: ${translationEntry}`);
    return {
      original: translationHTMLFilename,
      value: translationEntry,
    };
  }

  return {
    original: baseURLFileData[translationHTMLFilename]?.original,
    value:
      oldURLsLocaleData[translationHTMLFilename]?.value ||
      baseURLFileData[translationHTMLFilename]?.original,
  };
}

function processContentTranslationKey(
  locale,
  keyName,
  translatedString,
  localeData,
  baseFileData,
  oldLocaleData,
  contentPagesTranslationConfig
) {
  // Loop through the key's page appearances
  // Check the status of that page's translation config
  // If any of the page's locale config are set to true some page needs the translation and it must be included
  // If none of the pages the key is on are selected for translation in that locale, use the original from baseJson
  let atLeastOnePageAllowed = false;
  const baseJsonKeyDataPages = baseFileData[keyName].pages;
  const baseJsonKeyDataPagesKeys = Object.keys(baseJsonKeyDataPages);
  const localeKey = `translate_${locale.replaceAll("-", "_")}`;
  baseJsonKeyDataPagesKeys.map((pageKey) => {
    if (
      pageKey.startsWith("tags/") ||
      contentPagesTranslationConfig[pageKey][localeKey]
    ) {
      atLeastOnePageAllowed = true;
    }
    return;
  });

  // If at least one page is not allowed for this translation, use the original and exit early
  if (atLeastOnePageAllowed === false) {
    return {
      original: baseFileData[keyName]?.original,
      value: baseFileData[keyName]?.original,
    };
  }

  // Exit early if it's not a new translation
  if (
    !translatedString ||
    translatedString === oldLocaleData[keyName]?.value ||
    md.render(translatedString) === oldLocaleData[keyName]?.value
  ) {
    return !localeData[keyName]
      ? {
          original: baseFileData[keyName]?.original,
          value:
            oldLocaleData[keyName]?.value || baseFileData[keyName]?.original,
        }
      : localeData[keyName];
  }
  // Write the value to the locales
  return {
    original: baseFileData[keyName]?.original,
    value: translatedString,
    isNewTranslation: true,
  };
}

async function processTranslation(
  locale,
  translationFilename,
  translationsDirPath,
  oldLocaleData,
  oldURLsLocaleData,
  baseFileData,
  baseURLFileData,
  contentPagesTranslationConfig
) {
  const localeData = {};
  const localeURLsData = {};
  const translationsPath = getTranslationPath(
    locale,
    translationsDirPath,
    translationFilename
  );
  const fileContents = await readFileWithFallback(translationsPath, "");
  const translationHTMLFilename =
    getTranslationHTMLFilename(translationFilename);

  const data = YAML.parse(fileContents);

  // Check if theres a translation and
  // Add each obj to our locales data, excluding '_inputs' object.
  Object.entries(data).forEach(([keyName, translatedString]) => {
    if (keyName === "_inputs") {
      return;
    }

    // Write entry values to be any translated value that appears in translations files
    // If no value detected, and the locale value is an empty string, write the original to value as a fallback
    if (keyName === "urlTranslation") {
      const newEntry = processUrlTranslationKey(
        translatedString,
        translationHTMLFilename,
        baseURLFileData,
        oldURLsLocaleData
      );

      if (newEntry) {
        localeURLsData[translationHTMLFilename] = newEntry;
      } else if (
        // Provide a fallback if there's no translated URL so the translated URL isn't a blank string
        localeURLsData[translationHTMLFilename]?.value === "" ||
        localeURLsData[translationHTMLFilename]?.value === undefined
      ) {
        return {
          original: baseURLFileData[translationHTMLFilename]?.original,
          value: baseURLFileData[translationHTMLFilename]?.original,
        };
      }
      // Preserve old URL translation
      return {
        original: baseURLFileData[translationHTMLFilename]?.original,
        value: baseURLFileData[translationHTMLFilename]?.value,
      };
    }

    localeData[keyName] = processContentTranslationKey(
      locale,
      keyName,
      translatedString,
      localeData,
      baseFileData,
      oldLocaleData,
      contentPagesTranslationConfig
    );
  });

  return { data: localeData, urlData: localeURLsData };
}
