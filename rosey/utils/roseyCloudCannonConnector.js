import { generateTranslationFiles } from "./generateTranslationFiles.js";
import { callSmartling } from "./callSmartling.js";
import { generateLocales } from "./generateLocales.js";
import { readConfigFile } from "./helpers/file-helper.js";

(async () => {
  const configData = await readConfigFile("./rosey/config.yaml");
  await generateTranslationFiles(configData);
  await callSmartling(configData);
  await generateLocales(configData);
})();
