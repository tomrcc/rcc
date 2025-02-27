import markdownIt from "markdown-it";
import dotenv from "dotenv";
import { formatAndSlugifyMarkdownText } from "./markdown-formatters.js";
dotenv.config();
const md = markdownIt();

function updateDeeplyNestedObjectsAndReturnTranslations(
  structure,
  locales,
  valueToLookFor,
  pageTranslationData,
  baseJsonData,
  localesData,
  path = ""
) {
  // Check if something is a structure like array or obj
  // Arrays will also return true for typeof object
  if (!structure || typeof structure !== "object") {
    return false;
  }

  // If not an array, it's an object
  if (!Array.isArray(structure)) {
    const objectKeys = Object.keys(structure);
    // Check if it has the key, and update the obj if it does
    let objIncludeValueAtKey = "";

    // Loop objectKeys and look at the structure[key] to see if we've found the object with the original value
    // If we do, update objIncludeValue to the key containing it and break the loop
    // If the structure[key] has multiple block elements (usually paragraphs), search one of those blocks for the value
    for (let i = 0; i < objectKeys.length; i++) {
      const key = objectKeys[i];

      // Check we're in a translation frontmatter object
      if (inTheIncorrectObj(objectKeys, locales)) {
        break;
      }

      // If checking a string, split on new lines and check the resulting array for the phrase we're looking for
      let originalValueSplitByNewLine = [];
      if (typeof structure[key] === "string") {
        originalValueSplitByNewLine = structure[key]?.split("\n\n");
      }

      // Check the value if no new lines are present
      if (structure[key] === valueToLookFor) {
        objIncludeValueAtKey = key;
        break;
        // If multiple paragraphs, check if one of them is the value that we're looking for
      } else if (originalValueSplitByNewLine.includes(valueToLookFor)) {
        objIncludeValueAtKey = key;
        break;
      }
    }

    // Continue and update the structure containing the value, or recursively call the function again
    if (objIncludeValueAtKey) {
      // Create an object which will store multiple locales worth of translations that have been changed in visual editor
      // Return this object after writing any unchanged translations with new data from the data files
      // If this object is empty return undefined, and use that to check whether there is anything to write to data file
      let newTranslationsToWriteToDataFile = {};

      locales.forEach((locale) => {
        // Create key equivalents of the value we're looking for, with and without markdown namespace
        const valueToLookForAsAKey = generateRoseyId(valueToLookFor);
        const valueToLookForAsAMarkdownKey = [
          "markdown:",
          valueToLookForAsAKey,
        ].join("");

        const frontMatterLocaleKey = [
          locale.replace("-", "_"),
          "_translation",
        ].join("");

        // Try find a translation key in our data that matches the slugified value we are looking for as a key
        const translationPhraseToWrite =
          pageTranslationData[locale][valueToLookForAsAKey];

        if (translationPhraseToWrite) {
          const currentTranslationInFrontMatter =
            structure[frontMatterLocaleKey];
          const lastTranslationInLocales =
            localesData[locale][valueToLookForAsAKey];

          // Will need to check if the translation is different to the markdownified version of the latest locales
          // This means something has been qa'd in the visual editor and needs to be written to data file
          // Return a new translation with the key to write to
          const nothingInLocaleTranslation =
            currentTranslationInFrontMatter === "" ||
            !currentTranslationInFrontMatter;

          // If something in the frontmatter is different from the last round of saved translations
          if (
            lastTranslationInLocales &&
            currentTranslationInFrontMatter !== lastTranslationInLocales?.value
          ) {
            // If the translation is empty update it to the data file value
            if (nothingInLocaleTranslation) {
              structure[frontMatterLocaleKey] = translationPhraseToWrite;
            } else {
              if (!newTranslationsToWriteToDataFile[locale]) {
                newTranslationsToWriteToDataFile[locale] = {};
              }
              newTranslationsToWriteToDataFile[locale][valueToLookForAsAKey] =
                currentTranslationInFrontMatter;
            }
          } else {
            // If nothing is different in the visual editor
            // Sync the frontmatter with the translation phrase from the data file
            structure[frontMatterLocaleKey] = translationPhraseToWrite;
          }
        }

        // If it hasn't been found, try find it with markdown ns prepended
        // Whichever one returns a value tells us the translations and what type of input it is
        const translationPhraseMarkdownToWrite =
          pageTranslationData[locale][valueToLookForAsAMarkdownKey];

        // Throw a warning if we have found the phrase but no translation exists in the data files
        // Leave for debugging
        // if (!translationPhraseMarkdownToWrite && !translationPhraseToWrite) {
        //   console.log(
        //     `\n❌🔍 Found the original phrase: 💬💬${valueToLookFor.substring(0, 64)}...💬💬 in your content block at path: ${path}, but couldn't find a ${locale} translation key of \n ${valueToLookForAsAMarkdownKey} \nto update it with\n`
        //   );
        // }

        // If we find a translation phrase for the value found in frontmatter, add it to the correct locale
        // If its not markdown, we know we can just add it directly
        if (translationPhraseMarkdownToWrite) {
          const frontMatterLocaleValue = structure[frontMatterLocaleKey];
          const nothingInLocaleTranslation =
            frontMatterLocaleValue === "" || !frontMatterLocaleValue;

          // Split the original that we've just found by new line and turn them into keys (slugified)
          const originalValueSplitByNewLine = structure.original.split("\n\n");
          const splitOriginalPhrasesTurnedIntoKeys =
            originalValueSplitByNewLine.map((phrase) => {
              return `markdown:${generateRoseyId(phrase)}`;
            });

          // If theres only one paragraph
          if (originalValueSplitByNewLine.length === 1) {
            const lastTranslationInLocales = nhm.translate(
              localesData[locale][valueToLookForAsAMarkdownKey].value
            );

            // Check for new translations for single paragraph md inputs here
            // If something in the frontmatter is different from the last round of saved translations
            if (
              lastTranslationInLocales &&
              frontMatterLocaleValue !== lastTranslationInLocales
            ) {
              // If the translation is empty update it to the data file value
              if (nothingInLocaleTranslation) {
                structure[frontMatterLocaleKey] =
                  translationPhraseMarkdownToWrite;
              } else {
                // Otherwise we have found a translation updated in the frontmatter to write to data file
                console.log(
                  "🔄🔄 New single paragraph md translation in visual editor - returning translation to write to data file "
                );
                if (!newTranslationsToWriteToDataFile[locale]) {
                  newTranslationsToWriteToDataFile[locale] = {};
                }

                newTranslationsToWriteToDataFile[locale][
                  valueToLookForAsAMarkdownKey
                ] = frontMatterLocaleValue;
              }
            } else {
              // If nothing is different in the visual editor
              // Sync the frontmatter with the translation phrase from the data file
              structure[frontMatterLocaleKey] =
                translationPhraseMarkdownToWrite;
              console.log(`🔄🔄 Updated single paragraph markdown input`);
            }

            // If theres more than one paragraph in the markdown input
          } else if (originalValueSplitByNewLine.length > 1) {
            // Check logic for new translations for multiparagraph md inputs here
            const multiParagraphTranslationValues =
              typeof structure[frontMatterLocaleKey] === "string" &&
              structure[frontMatterLocaleKey].includes("\n\n")
                ? frontMatterLocaleValue.split("\n\n")
                : [];

            // Create an array of empty strings of length of the original
            const arrayToWrite = Array(originalValueSplitByNewLine.length).fill(
              ""
            );

            // Go through the current front matter and add the values to their index in the array
            splitOriginalPhrasesTurnedIntoKeys.map((key, index) => {
              const phraseFromDataFile = pageTranslationData[locale][key];

              const currentTranslationInFrontMatter =
                multiParagraphTranslationValues[index];

              const currentTranslationInFrontMatterHtml =
                currentTranslationInFrontMatter
                  ? md.render(currentTranslationInFrontMatter)
                  : "";

              const keyInLocalesData = Object.keys(
                localesData[locale]
              ).includes(key);

              // Before we call this a new translation in the visual editor we need to check
              // We can't find a translation matching in the locale or data file data
              // There is the same number of paragraphs/block elements in the original as in the translation
              // It's not an entirely new translation because it's key exists in the locales data (last builds successful translations)
              if (
                !getKeyByValue(
                  localesData[locale],
                  currentTranslationInFrontMatterHtml
                ) &&
                !getKeyByValue(
                  pageTranslationData[locale],
                  currentTranslationInFrontMatter
                ) &&
                multiParagraphTranslationValues.length ===
                  originalValueSplitByNewLine.length &&
                keyInLocalesData
              ) {
                // We also need to check nothing has changed in the data file
                // so that changes in the data file are reflected in the visual editor and aren't overwritten by the old
                // frontmatter translation
                const lastTranslationInLocales = localesData[locale][key].value;
                const isNewDataFileTranslation =
                  lastTranslationInLocales !== md.render(phraseFromDataFile);

                if (!isNewDataFileTranslation) {
                  console.log(
                    "This is a new translation in the visual editor: ",
                    currentTranslationInFrontMatter
                  );

                  if (!newTranslationsToWriteToDataFile[locale]) {
                    newTranslationsToWriteToDataFile[locale] = {};
                  }

                  newTranslationsToWriteToDataFile[locale][key] =
                    currentTranslationInFrontMatter;

                  arrayToWrite.splice(
                    index,
                    1,
                    currentTranslationInFrontMatter
                  );
                  return;
                }
              }

              arrayToWrite.splice(index, 1, phraseFromDataFile);
              return;
            });

            // Join the result and make that the new multiparagraph translation
            const multiParagraphInputRejoined = arrayToWrite.join("\n\n");

            structure[frontMatterLocaleKey] = multiParagraphInputRejoined;
          }
        }
      });
      return Object.keys(newTranslationsToWriteToDataFile).length
        ? newTranslationsToWriteToDataFile
        : undefined;
    } else {
      // If not in the right structure, or haven't found the value
      // Loop through the other keys in objectKeys and check if they're typeof obj
      // If they are recursively call this fn with the key
      for (let j = 0; j < objectKeys.length; j++) {
        const key = objectKeys[j];
        let currentPath = path !== "" ? `${path}.${key}` : key;
        const result = updateDeeplyNestedObjectsAndReturnTranslations(
          structure[objectKeys[j]],
          locales,
          valueToLookFor,
          pageTranslationData,
          baseJsonData,
          localesData,
          currentPath
        );
        if (result) {
          return result;
        }
      }
    }
  } else {
    // If we are in array
    // Don't check for key: value since we are in array
    // Just look if each item is typeof object and recursively call this fn on the array item if it is
    for (let j = 0; j < structure.length; j++) {
      let currentPath = `${path}[${j}]`;
      const result = updateDeeplyNestedObjectsAndReturnTranslations(
        structure[j],
        locales,
        valueToLookFor,
        pageTranslationData,
        baseJsonData,
        localesData,
        currentPath
      );
      if (result) {
        return result;
      }
    }
  }
}

function updateDeeplyNestedTranslationObjects(
  structure,
  locales,
  valueToLookFor,
  newPageTranslationData,
  path = ""
) {
  // Check if something is a structure like array or obj
  // Arrays will also return true for typeof object
  if (!structure || typeof structure !== "object") {
    return false;
  }

  // If not an array, it's an object
  if (!Array.isArray(structure)) {
    const objectKeys = Object.keys(structure);
    // Check if it has the key, and update the obj if it does
    let objIncludeValueAtKey = "";

    // Loop objectKeys and look at the structure[key] to see if we've found the object with the original value
    // If we do, update objIncludeValue to the key containing it and break the loop
    // If the structure[key] has multiple block elements(usually paragraphs), search one of those blocks for the value
    for (let i = 0; i < objectKeys.length; i++) {
      const key = objectKeys[i];

      // Check we're in a translation frontmatter object
      if (inTheIncorrectObj(objectKeys, locales)) {
        break;
      }

      // If checking a string, split on new lines and check the resulting array for the phrase we're looking for
      let originalValueSplitByNewLine = [];
      if (typeof structure[key] === "string") {
        originalValueSplitByNewLine = structure[key]?.split("\n\n");
      }

      // Check the value if no new lines are present
      if (structure[key] === valueToLookFor) {
        objIncludeValueAtKey = key;
        break;
        // If multiple paragraphs, check if one of them is the value that we're looking for
      } else if (originalValueSplitByNewLine.includes(valueToLookFor)) {
        objIncludeValueAtKey = key;
        break;
      }
    }

    // Continue and update the structure containing the value, or recursively call the function again
    if (objIncludeValueAtKey) {
      // Create an object which will store multiple locales worth of translations that have been changed in visual editor
      // Return this object after writing any unchanged translations with new data from the data files
      // If this object is empty return undefined, and use that to check whether there is anything to write to data file

      locales.forEach((locale) => {
        const valueToLookForAsAKey = generateRoseyId(valueToLookFor);
        const valueToLookForAsAMarkdownKey = [
          "markdown:",
          valueToLookForAsAKey,
        ].join("");

        const frontMatterLocaleKey = [
          locale.replace("-", "_"),
          "_translation",
        ].join("");

        // Try find a translation key in our data that matches the slugified value we are looking for as a key
        const translationPhraseToWrite =
          newPageTranslationData[locale][valueToLookForAsAKey];

        if (translationPhraseToWrite) {
          // Sync the frontmatter with the translation phrase from the data file
          structure[frontMatterLocaleKey] = translationPhraseToWrite;
        }

        // If it hasn't been found, try find it with markdown ns prepended
        // Whichever one returns a value tells us the translations and what type of input it is
        const translationPhraseMarkdownToWrite =
          newPageTranslationData[locale][valueToLookForAsAMarkdownKey];

        // Throw a warning if we have found the phrase but no translation exists in the data files
        if (!translationPhraseMarkdownToWrite && !translationPhraseToWrite) {
          console.log(
            `\n❌🔍 Found the original phrase: 💬💬${valueToLookFor.substring(0, 64)}...💬💬 in your content block at path: ${path}, but couldn't find a ${locale} translation key of \n ${valueToLookForAsAMarkdownKey} \nto update it with\n`
          );
        }

        // If we find a translation phrase for the value found in frontmatter, add it to the correct locale
        // If its not markdown, we know we can just add it directly
        if (translationPhraseMarkdownToWrite) {
          // Split the original that we've just found by new line and turn them into keys (slugified)
          const originalValueSplitByNewLine = structure.original.split("\n\n");
          const splitOriginalPhrasesTurnedIntoKeys =
            originalValueSplitByNewLine.map((phrase) => {
              return `markdown:${generateRoseyId(phrase)}`;
            });

          // If theres only one paragraph
          if (originalValueSplitByNewLine.length === 1) {
            // Sync the frontmatter with the translation phrase from the data file
            structure[frontMatterLocaleKey] = translationPhraseMarkdownToWrite;
            console.log(`🔄🔄 Updated single paragraph markdown input`);

            // If theres more than one paragraph
          } else if (originalValueSplitByNewLine.length > 1) {
            // Check logic for new translations for multiparagraph md inputs here

            // Create an array of empty strings of length of the original
            const arrayToWrite = Array(originalValueSplitByNewLine.length).fill(
              ""
            );

            // Go through the current front matter and add the values to their index in the array
            splitOriginalPhrasesTurnedIntoKeys.map((key, index) => {
              const phraseFromDataFile = newPageTranslationData[locale][key];

              arrayToWrite.splice(index, 1, phraseFromDataFile);
              return;
            });

            // Join the result and make that the new multiparagraph translation
            const multiParagraphInputRejoined = arrayToWrite.join("\n\n");

            structure[frontMatterLocaleKey] = multiParagraphInputRejoined;
          }
        }
      });
      // return Object.keys(newTranslationsToWriteToDataFile).length
      //   ? newTranslationsToWriteToDataFile
      //   : undefined;
    } else {
      // If not in the right structure, or haven't found the value
      // Loop through the other keys in objectKeys and check if they're typeof obj
      // If they are recursively call this fn with the key
      for (let j = 0; j < objectKeys.length; j++) {
        const key = objectKeys[j];
        let currentPath = path !== "" ? `${path}.${key}` : key;
        const result = updateDeeplyNestedTranslationObjects(
          structure[objectKeys[j]],
          locales,
          valueToLookFor,
          newPageTranslationData,
          currentPath
        );
        if (result) {
          return result;
        }
      }
    }
  } else {
    // If we are in array
    // Don't check for key: value since we are in array
    // Just look if each item is typeof object and recursively call this fn on the array item if it is
    for (let j = 0; j < structure.length; j++) {
      let currentPath = `${path}[${j}]`;
      const result = updateDeeplyNestedTranslationObjects(
        structure[j],
        locales,
        valueToLookFor,
        newPageTranslationData,
        currentPath
      );
      if (result) {
        return result;
      }
    }
  }
}

// Keep track of any bookshop components found
// Don't return the function ever, just update the let, and let the function run on all keys
// Once the function has run, return the let from the bigger function
function findInstancesOfComponent(structure, componentNameToLookFor) {
  const foundComponents = [];
  function getObjWithPathFromNestedStructure(
    structure,
    componentNameToLookFor,
    path = ""
  ) {
    // Arrays will also return true for typeof object
    if (!structure || typeof structure !== "object") {
      return false;
    }

    // Check if something is a structure like array or obj
    // If it's an object
    if (!Array.isArray(structure)) {
      const objectKeys = Object.keys(structure);
      // Check if it has the key, and return the whole obj if it does
      let objIncludeValueAtKey = "";
      // Loop objectKeys and look the structure[key] to see if we've found the value
      // If we do, update objIncludeValue to true and break the loop
      for (let i = 0; i < objectKeys.length; i++) {
        const key = objectKeys[i];
        if (
          structure[key] === componentNameToLookFor &&
          key === "_bookshop_name"
        ) {
          objIncludeValueAtKey = key;
        }
      }
      // Continue and return the structure containing the value with the path, or recursively call the function again
      if (objIncludeValueAtKey) {
        foundComponents.push({
          structure: structure,
          path: `${path}.${objIncludeValueAtKey}`,
        });
      } else {
        // If not, loop through the other keys in objectKeys and check if they're typeof obj
        // if they are recursively call this fn with the key
        for (let j = 0; j < objectKeys.length; j++) {
          const key = objectKeys[j];
          let currentPath = path !== "" ? `${path}.${key}` : key;
          const result = getObjWithPathFromNestedStructure(
            structure[key],
            componentNameToLookFor,
            currentPath
          );
          if (result) {
            return result;
          }
        }
      }
    } else {
      // Don't check for key: value since we are in array
      // Just look if each item is typeof object and recursively call this fn on the array item if it is
      for (let j = 0; j < structure.length; j++) {
        let currentPath = `${path}[${j}]`;
        const result = getObjWithPathFromNestedStructure(
          structure[j],
          componentNameToLookFor,
          currentPath
        );
        if (result) {
          return result;
        }
      }
    }
  }
  getObjWithPathFromNestedStructure(structure, componentNameToLookFor);
  return foundComponents;
}

const generateRoseyId = (text) => {
  if (!text) {
    return "";
  }
  return formatAndSlugifyMarkdownText(text);
};

function getKeyByValue(object, value) {
  return Object.keys(object).find((key) => {
    return object[key] === value;
  });
}

function inTheIncorrectObj(objectKeys, locales) {
  let isIncorrectObj = false;
  locales.forEach((locale) => {
    if (!objectKeys.includes(`${locale.replace("-", "_")}_translation`)) {
      isIncorrectObj = true;
    }
  });
  if (!objectKeys.includes("original")) {
    isIncorrectObj = true;
  }
  return isIncorrectObj;
}

export {
  updateDeeplyNestedObjectsAndReturnTranslations,
  updateDeeplyNestedTranslationObjects,
  findInstancesOfComponent,
};
