import fs from "fs";
import path from "path";
import YAML from "yaml";
import { visit } from "unist-util-visit";
import { fromHtmlIsomorphic } from "hast-util-from-html-isomorphic";
import dotenv from "dotenv";

import {
  isDirectory,
  readFileWithFallback,
  readConfigFile,
} from "./helpers/file-helper.js";
import { findInstancesOfComponent } from "./helpers/block-walkers.js";

dotenv.config();

// Main function
(async () => {
  const configData = await readConfigFile("./rosey/config.yaml");
  const locales = configData.locales;
  const contentDirPath = configData.visual_editing.content_directory;
  const componentDirectoryPath =
    configData.visual_editing.migrator_settings.components_directory;

  const componentFiles = await fs.promises.readdir(componentDirectoryPath, {
    recursive: true,
  });

  // Get directories of bookshop components
  const bookshopDirArray = [];
  await Promise.all(
    componentFiles.map(async (componentFile) => {
      const filePath = path.join(componentDirectoryPath, componentFile);
      if (await isThisABookshopDir(filePath)) {
        bookshopDirArray.push(filePath);
      }
      return;
    })
  );

  // Get the .astro files from the Bookshop directories
  const astroBookshopFiles = [];
  await Promise.all(
    bookshopDirArray.map(async (dir) => {
      const dirFiles = await fs.promises.readdir(dir);
      dirFiles.map((file) => {
        if (file.endsWith(".astro")) {
          const fullPath = path.join(dir, file);
          astroBookshopFiles.push(fullPath);
        }
      });
    })
  );

  // Update .astro components props to use the visual editor
  // Return the paths of the updated props
  const componentPathsToUpdate = {};
  await Promise.all(
    astroBookshopFiles.map(async (file) => {
      const fileContents = await readFileWithFallback(file);

      componentPathsToUpdate[file] = await findPropsWithVisualAdaptorFn(
        fileContents,
        file
      );
    })
  );

  let thereAreKeysToUpdate = false;
  // Update any content pages if there are any that need it
  const componentPathsToUpdateKeys = Object.keys(componentPathsToUpdate);
  if (componentPathsToUpdateKeys.length) {
    componentPathsToUpdateKeys.map((key) => {
      const componentKeysToUpdate = componentPathsToUpdate[key];
      if (componentKeysToUpdate.length) {
        thereAreKeysToUpdate = true;
      }
    });
  }

  if (thereAreKeysToUpdate) {
    const contentDirectoryFiles = await fs.promises.readdir(contentDirPath, {
      recursive: true,
    });

    const markdownContentFiles = [];
    contentDirectoryFiles.map((file) => {
      if (file.endsWith(".md") || file.endsWith(".mdx")) {
        markdownContentFiles.push(file);
      }
    });

    const componentNamesToUpdate = componentPathsToUpdateKeys.map(
      (componentFileName) => {
        // TODO: FIX THIS PATH TO USE CONFIG FILE
        const fileWithoutComponentDir =
          componentFileName.split("src/components")[1];
        return fileWithoutComponentDir.substring(
          fileWithoutComponentDir.indexOf("/") + 1,
          fileWithoutComponentDir.lastIndexOf("/")
        );
      }
    );
    markdownContentFiles.map(async (file) => {
      const filePath = path.join(contentDirPath, file);
      const fileContents = await readFileWithFallback(filePath);
      const fileContentsArray = fileContents
        .split("---")
        .filter((value) => value !== "");
      const fileFrontmatter = YAML.parse(fileContentsArray[0]);
      const fileContentBlocksToWrite = fileFrontmatter.content_blocks;

      if (fileContentBlocksToWrite) {
        // Search for bookshop component with the name of the component we're looking to update
        let needToWritePage = false;

        fileContentBlocksToWrite.map((bookshopComponent, index) => {
          const bookshopComponentName = bookshopComponent._bookshop_name;
          componentNamesToUpdate.map((componentNameToUpdate) => {
            // Even if there's no props to update for this component, we need to search for other nested components
            if (
              bookshopComponentName &&
              bookshopComponentName !== componentNameToUpdate
            ) {
              const nestedBookshopComponents = findInstancesOfComponent(
                bookshopComponent,
                componentNameToUpdate
              );

              if (nestedBookshopComponents.length) {
                // Loop through any nested components we find
                nestedBookshopComponents.map((nestedComponent) => {
                  // Get any props to update for each component and if there is
                  const nestedComponentPath =
                    nestedComponent.path.split("._bookshop_name")[0];
                  const nestedComponentContents = nestedComponent.structure;

                  const componentNameToUpdateSplitByDir =
                    componentNameToUpdate.split("/");

                  const componentToUpdateFilePath = path.join(
                    componentDirectoryPath.replace("./", ""),
                    componentNameToUpdate,
                    `${componentNameToUpdateSplitByDir[componentNameToUpdateSplitByDir.length - 1]}.astro`
                  );

                  const propsToUpdateForThisComponent =
                    componentPathsToUpdate[componentToUpdateFilePath];

                  const propsToUpdateForThisComponentKeys = Object.keys(
                    propsToUpdateForThisComponent
                  );

                  if (!propsToUpdateForThisComponentKeys.length) {
                    console.log(
                      "No props to update for component",
                      componentNameToUpdate
                    );
                    return;
                  }

                  propsToUpdateForThisComponent.map((propPath) => {
                    // Get the value at the address of the prop in the component
                    const propValue = deepGetByPath(
                      nestedComponentContents,
                      propPath
                    );
                    // Check its not already a translation object, if it is don't do anything
                    if (
                      typeof propValue === "object" &&
                      !Array.isArray(propValue)
                    ) {
                      const propValueKeys = Object.keys(propValue);
                      // If it's already migrated return
                      if (propValueKeys.includes("original")) {
                        return;
                      }
                    }
                    // Modify the value at the address of the prop to be the translation obj
                    console.log(`Found an unmigrated frontmatter value...`);
                    console.log(`prop: `, propPath, "propValue: ", propValue);

                    // Create the translations object and add locales
                    const newTranslationsObject = {
                      original: propValue,
                    };
                    locales.map((locale) => {
                      const localeKeyName = `${locale.replace("-", "_")}_translation`;
                      newTranslationsObject[localeKeyName] = "";
                    });

                    const nestedComponentPropPathUnformatted = [
                      nestedComponentPath,
                      propPath,
                    ]
                      .join(".")
                      .replaceAll("[", ".")
                      .replaceAll("]", "");

                    const nestedComponentPropPath =
                      nestedComponentPropPathUnformatted.endsWith(".")
                        ? nestedComponentPropPathUnformatted.substring(
                            0,
                            nestedComponentPropPathUnformatted.length
                          )
                        : nestedComponentPropPathUnformatted;

                    // Change the unmigrated prop to have a translations obj
                    setValue(
                      nestedComponentPropPath,
                      newTranslationsObject,
                      bookshopComponent
                    );
                    // Add the updated nested component back to the parent component using the path
                    // Add the updated parent component back to content blocks
                    fileContentBlocksToWrite[index] = bookshopComponent;
                    // Write page set to true
                    needToWritePage = true;
                    console.log(
                      "Updated nested bookshop component with translation object"
                    );
                  });
                });
              }
            }

            if (bookshopComponentName === componentNameToUpdate) {
              const componentToUpdateFilePath = path.join(
                componentDirectoryPath.replace("./", ""),
                componentNameToUpdate,
                `${componentNameToUpdate}.astro`
              );
              const propsToUpdateForThisComponent =
                componentPathsToUpdate[componentToUpdateFilePath];

              const propsToUpdateForThisComponentKeys = Object.keys(
                propsToUpdateForThisComponent
              );

              if (!propsToUpdateForThisComponentKeys.length) {
                console.log(
                  "No props to update for component",
                  componentNameToUpdate
                );
                return;
              }

              propsToUpdateForThisComponent.map((propPath) => {
                // Get the value at the address of the prop in the component

                const propValue = deepGetByPath(bookshopComponent, propPath);
                // Check its not already a translation object, if it is don't do anything
                if (
                  typeof propValue === "object" &&
                  !Array.isArray(propValue)
                ) {
                  const propValueKeys = Object.keys(propValue);
                  // If it's already migrated return
                  if (propValueKeys.includes("original")) {
                    return;
                  }
                }
                // Modify the value at the address of the prop to be the translation obj
                console.log(`Found an unmigrated frontmatter value...`);
                console.log(`prop: `, propPath, "propValue: ", propValue);
                // Create the translations object and add locales
                const newTranslationsObject = {
                  original: propValue,
                };
                locales.map((locale) => {
                  const localeKeyName = `${locale.replace("-", "_")}_translation`;
                  newTranslationsObject[localeKeyName] = "";
                });
                // Change the unmigrated prop to have a translations obj
                setValue(propPath, newTranslationsObject, bookshopComponent);
                fileContentBlocksToWrite[index] = bookshopComponent;
                needToWritePage = true;
              });
            }
          });
        });

        // Write the page if we need to
        if (needToWritePage) {
          console.log("Overwriting page: ", filePath);
          fileFrontmatter.content_blocks = fileContentBlocksToWrite;
          const formattedFrontMatter = [
            "---",
            YAML.stringify(fileFrontmatter),
            "---",
          ].join("\n");
          fileContentsArray[0] = formattedFrontMatter;
          const newContentFileToWrite = fileContentsArray.join("\n");
          await fs.promises.writeFile(filePath, newContentFileToWrite);
        }
      }
    });
  }
})();

async function isThisABookshopDir(directory) {
  if (!(await isDirectory(directory))) {
    return false;
  }
  const directoryFiles = await fs.promises.readdir(directory);
  let isABookshopDir = false;
  directoryFiles.map((file) => {
    if (file.endsWith(".bookshop.yml")) {
      isABookshopDir = true;
    }
  });
  return isABookshopDir;
}

const deepGet = (obj, keys) => keys.reduce((xs, x) => xs?.[x] ?? null, obj);

const deepGetByPath = (obj, path) =>
  deepGet(
    obj,
    path
      .replace(/\[([^\[\]]*)\]/g, ".$1.")
      .split(".")
      .filter((t) => t !== "")
  );

const setValue = (propertyPath, value, obj) => {
  // this is a super simple parsing, you will want to make this more complex to handle correctly any path
  // it will split by the dots at first and then simply pass along the array (on next iterations)
  let properties = Array.isArray(propertyPath)
    ? propertyPath
    : propertyPath.split(".");

  // Not yet at the last property so keep digging
  if (properties.length > 1) {
    // The property doesn't exists OR is not an object (and so we overwritte it) so we create it
    if (
      !obj.hasOwnProperty(properties[0]) ||
      typeof obj[properties[0]] !== "object"
    )
      obj[properties[0]] = {};
    // We iterate.
    return setValue(properties.slice(1), value, obj[properties[0]]);
    // This is the last property - the one where to set the value
  } else {
    // We set the value to the last property
    obj[properties[0]] = value;
    return true; // this is the end
  }
};

async function findPropsWithVisualAdaptorFn(fileContents, file) {
  const fileContentsSplit = fileContents.split("---");
  const bodyContent = fileContentsSplit[2];
  const hastTree = fromHtmlIsomorphic(bodyContent, { fragment: true });
  const propsToUpdate = [];
  let propsToUpdateWithoutVariableNames = [];

  visit(hastTree, function (node) {
    // A node with a data-rosey tag on it
    if (node.properties && node.properties.dataRosey) {
      const replaceChildrenAtIndex = {};
      node.children.map((child, index) => {
        const childValue = child.value.trim();
        if (childValue.includes("{selectRoseyTranslation(")) {
          // If its a prop it has frontmatter to be migrated
          const childValueSplit = childValue.split("{selectRoseyTranslation(");
          const childValueIfProp = childValueSplit[1];
          if (childValueIfProp) {
            const childValueIfPropSplit = childValueIfProp.split(")}");
            const propValue =
              childValueIfPropSplit.length > 1
                ? childValueIfPropSplit[0]
                : undefined;

            // If we find an end tag, its more likely its a prop
            // Add it to props to update for updating frontmatter
            if (propValue) {
              if (!propsToUpdate.includes(propValue)) {
                propsToUpdate.push(propValue.trim().split(",")[0]);
              }

              // Update the prop to be wrapped in the selectRoseyTranslation fn
              replaceChildrenAtIndex[index] = childValue;
            }
          }
        }
      });
    }

    // Add markdown components to content to be migrated
    // And add selected_page_translation
    if (node.type === "element" && node.tagName === "markdown") {
      if (node.properties && node.properties.selected_page_translation) {
        const fileContentsArray = [];
        fileContentsSplit.map((contents) => {
          if (contents !== "") {
            fileContentsArray.push(contents);
          }
        });

        // Add to the propsToUpdate
        const nodeContent = node.properties.content;
        if (nodeContent) {
          const nodeContentPropName = nodeContent.split("{")[1].split("}")[0];
          if (!propsToUpdate.includes(nodeContentPropName)) {
            propsToUpdate.push(nodeContentPropName.trim().trim().split(",")[0]);
          }
        }
      }
    }
  });

  if (propsToUpdate.length) {
    const fileContentsArray = [];
    fileContentsSplit.map((contents) => {
      if (contents !== "") {
        fileContentsArray.push(contents);
      }
    });

    const frontMatterData = fileContentsArray[0];
    const propsVariableName = findAstroPropsVariableName(frontMatterData);
    // Remove variable name from props if there is one
    if (propsVariableName.length > 0) {
      const propsWithoutVariableName = propsToUpdate.map((prop) => {
        return prop.split(`${propsVariableName}.`)[1];
      });
      propsToUpdateWithoutVariableNames = propsWithoutVariableName;
    } else {
      propsToUpdateWithoutVariableNames = propsToUpdate;
    }
  }

  // console.log(file);
  // console.log(propsToUpdateWithoutVariableNames);
  return propsToUpdateWithoutVariableNames;
}

function findAstroPropsVariableName(frontMatterData) {
  let propsVariableName = "";
  const frontMatterDataSplitByLine = frontMatterData.split("\n");
  frontMatterDataSplitByLine.map((line) => {
    if (line.startsWith("const ") && line.endsWith(" = Astro.props;")) {
      const lineLessConst = line.split("const ")[1];
      const lineLessAstro = lineLessConst.split(" = Astro.props;")[0];
      propsVariableName = lineLessAstro;
    }
  });
  return propsVariableName;
}
