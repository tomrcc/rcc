import {
  SmartlingApiClientBuilder,
  SmartlingJobsApi,
  SmartlingJobBatchesApi,
  SmartlingFilesApi,
  CreateJobParameters,
  CreateBatchParameters,
  UploadBatchFileParameters,
  FileType,
  DownloadFileParameters,
  RetrievalType,
} from "smartling-api-sdk-nodejs";
import fs from "fs";
import YAML from "yaml";
import path from "path";
import dotenv from "dotenv";
import {
  readJsonFromFile,
  isDirectory,
  readFileWithFallback,
  readConfigFile,
} from "./helpers/file-helper.js";
dotenv.config();

(async () => {
  // We use one object for all translations, and group them under the name /rosey/translations/
  // A URI is used by smartling as a unique identifier for the set of files being translated
  // A path needs to be more explicit and say the path begins from the directory being executed in (the root)
  const configData = await readConfigFile("./rosey/config.yaml");

  // Get variables
  const userSecret = process.env.DEV_USER_SECRET;
  const projectId = configData.smartling.dev_project_id;
  const userId = configData.smartling.dev_user_identifier;
  const smartlingTranslateEnabled = configData.smartling.smartling_enabled;
  const authRequestData = {
    userIdentifier: userId,
    userSecret: userSecret,
  };
  const roseyBaseFilePath = configData.rosey_paths.rosey_base_file_path;
  const incomingTranslationsDir =
    configData.smartling.incoming_translations_dir;
  const outgoingTranslationsFilePath =
    configData.smartling.outgoing_translations_file_path;
  const outgoingTranslationFileUri =
    configData.smartling.outgoing_translation_file_uri;
  const pingInterval = configData.smartling.ping_interval;
  const pingMaximum = configData.smartling.ping_maximum;
  const pingsToWaitForAuth = configData.smartling.pings_to_wait_for_auth;

  // Loop through all pages frontmatter so we can get the translations obj
  // Check if the page has any translate_locale set to true and if it does add it to pagesToTranslate
  const excludedContentFiles = configData.visual_editing.excluded_files;
  const contentDirectory = configData.visual_editing.content_directory;
  const locales = configData.locales;

  const contentDirectoryFilesUnfiltered = await fs.promises.readdir(
    contentDirectory,
    {
      recursive: true,
    }
  );
  const pagesToTranslate = ["404.html"];

  await Promise.all(
    contentDirectoryFilesUnfiltered.map(async (file) => {
      const filePath = path.join("src", "content", file);
      if (
        !(await isDirectory(filePath)) &&
        !excludedContentFiles.includes(file)
      ) {
        // Check pages frontmatter to see if we should translate
        const fileRawData = await readFileWithFallback(filePath);
        const fileFrontmatter = YAML.parse(fileRawData.split("---")[1]);
        const pageTranslationsConfig = fileFrontmatter.translations ?? {};
        const pageTranslationsConfigKeys = Object.keys(pageTranslationsConfig);
        // Check frontmatter translations obj
        // Check if any of the one's that aren't selected translation are true
        // If they are, push the page to the pages to translate array
        let pageHasATranslationEnabled = false;
        pageTranslationsConfigKeys.forEach((key) => {
          const translationConfigValue = pageTranslationsConfig[key];
          if (translationConfigValue === true) {
            pageHasATranslationEnabled = true;
          }
        });
        if (pageHasATranslationEnabled) {
          pagesToTranslate.push(file);
        }
      }
    })
  );

  // Create factory for building API clients.
  const apiBuilder = new SmartlingApiClientBuilder()
    .setBaseSmartlingApiUrl("https://api.smartling.com")
    .authWithUserIdAndUserSecret(userId, userSecret);

  // Instantiate the APIs we'll need.
  const jobsApi = apiBuilder.build(SmartlingJobsApi);
  const batchesApi = apiBuilder.build(SmartlingJobBatchesApi);
  const filesApi = apiBuilder.build(SmartlingFilesApi);

  // Create outgoing translations file
  await generateOutgoingTranslationFile(
    roseyBaseFilePath,
    outgoingTranslationsFilePath,
    pagesToTranslate
  );

  if (!smartlingTranslateEnabled || smartlingTranslateEnabled === "false") {
    console.log("⏭️ Smartling translation disabled - skipping API call");
    return;
  } else {
    console.log(
      "✅✅ Smartling translation enabled - continuing with API call"
    );
  }

  // Get the outgoing translation file, and one of the last returned set of translations
  const outgoingTranslationsFileData = await readJsonFromFile(
    outgoingTranslationsFilePath
  );

  // Check here if the outgoingTranslationFile is empty
  // There may be a new translation which passes the check below, but it's page is excluded from translations
  // If that is the case, outgoingTranslationFile is empty - don't proceed with the call

  const outgoingTranslationFileDataKeys = Object.keys(
    outgoingTranslationsFileData
  );
  if (outgoingTranslationFileDataKeys.length < 1) {
    console.log("⏭️⏭️ Nothing to send to Smartling - skipping API call");
    return;
  } else {
    console.log(
      "✅✅ Detected a new translation and page(s) have translations enabled - continuing with API call"
    );
  }

  const incomingTranslationsFiles = await fs.promises.readdir(
    incomingTranslationsDir
  );
  const firstIncomingTranslationFilePath = path.join(
    incomingTranslationsDir,
    incomingTranslationsFiles[0]
  );
  const firstIncomingTranslationFileData = await readJsonFromFile(
    firstIncomingTranslationFilePath
  );

  // Get both objects sets of keys
  const outgoingTranslationObjectKeys = Object.keys(
    outgoingTranslationsFileData
  );
  const firstIncomingTranslationObjectKeys = Object.keys(
    firstIncomingTranslationFileData
  );

  // If there is a key in the outgoing translations that isn't in incoming, we need to call the api
  let isThereANewTranslation = false;
  for (let i = 0; i < outgoingTranslationObjectKeys.length; i++) {
    const key = outgoingTranslationObjectKeys[i];
    if (!firstIncomingTranslationObjectKeys.includes(key)) {
      isThereANewTranslation = true;
      break;
    }
  }

  if (!isThereANewTranslation) {
    console.log("⏭️⏭️ No new translation - skipping API call");
    return;
  } else {
    console.log("✅✅ New translation detected - continuing with API call");
  }

  // Get a token
  const authData = await getSmartlingAuth(
    "https://api.smartling.com/auth-api/v2/authenticate",
    authRequestData
  );
  const authToken = authData.response.data.accessToken;

  // Create job.
  const createJobParams = new CreateJobParameters().setName(
    `Test job name ${Date.now()}`
  );

  const job = await jobsApi.createJob(projectId, createJobParams);

  // Create job batch parameters
  const createBatchParams = new CreateBatchParameters()
    .setTranslationJobUid(job.translationJobUid)
    .setAuthorize(true);

  // Add file URIs to the batch parameters
  createBatchParams.addFileUri(outgoingTranslationFileUri);

  // Create batch
  const batch = await batchesApi.createBatch(projectId, createBatchParams);

  const uploadBatchFileParams = new UploadBatchFileParameters()
    .setFile(outgoingTranslationsFilePath)
    .setFileUri(outgoingTranslationFileUri)
    .setFileType(FileType.JSON)
    .setLocalesToApprove(locales);

  await batchesApi.uploadBatchFile(
    projectId,
    batch.batchUid,
    uploadBatchFileParams
  );

  console.log(
    `✅✅ Uploaded file ${outgoingTranslationsFilePath} to Smartling`
  );

  // Call Job Status API until translation is completed, or we timeout.

  const jobInfoUrlString = `https://api.smartling.com/jobs-api/v3/projects/${projectId}/jobs/${job.translationJobUid}`;

  let pingCount = 0;

  const checkJobStatus = setInterval(async () => {
    console.log("🔍 Checking translation job status...");

    const smartlingJobData = await fetchSmartlingData(
      jobInfoUrlString,
      authToken
    );
    const jobStatus = smartlingJobData.response.data.jobStatus;

    if (pingCount >= pingMaximum) {
      console.log(
        `⏰ Timing out Smartling connection after ${pingCount} API calls.`
      );
      clearInterval(checkJobStatus);
    }
    pingCount++;
    console.log(`☎️  Smartling translation job status API call: ${pingCount}`);

    switch (jobStatus) {
      case "COMPLETED":
        console.log(`✅✅ Translation: ${jobStatus}, downloading files now!`);
        clearInterval(checkJobStatus);

        // Get the base.json data to check if keys are old
        const baseFileData = await readJsonFromFile(roseyBaseFilePath);
        const baseFileDataKeys = Object.keys(baseFileData.keys);

        for (const locale of locales) {
          // Get the downloaded translations for each locale
          const downloadFileParams =
            new DownloadFileParameters().setRetrievalType(
              RetrievalType.PUBLISHED
            );
          const downloadedFileContent = await filesApi.downloadFile(
            projectId,
            outgoingTranslationFileUri,
            locale,
            downloadFileParams
          );
          const downloadedFileData = JSON.parse(downloadedFileContent);

          // Check if the directory exists, if not create it
          if (!fs.existsSync(incomingTranslationsDir)) {
            fs.mkdirSync(incomingTranslationsDir);
            console.log(`🏗️ Directory '${incomingTranslationsDir}' created.`);
          }

          // Once we receive something back update our existing smartling translations
          const existingSmartlingTranslationsPath = path.join(
            incomingTranslationsDir,
            `${locale}.json`
          );
          const existingSmartlingTranslationsData = await readJsonFromFile(
            existingSmartlingTranslationsPath
          );

          const downloadedFileDataKeys = Object.keys(downloadedFileData);
          downloadedFileDataKeys.forEach((key) => {
            existingSmartlingTranslationsData[key] = downloadedFileData[key];
          });

          // Scan through our incoming translations for keys no longer in our base.json and delete them
          const existingSmartlingTranslationsKeys = Object.keys(
            existingSmartlingTranslationsData
          );

          existingSmartlingTranslationsKeys.forEach((key) => {
            if (!baseFileDataKeys.includes(key)) {
              console.log("Deleting old key: ", key);
              delete existingSmartlingTranslationsData[key];
            }
          });

          // Write the updated translations
          fs.writeFileSync(
            existingSmartlingTranslationsPath,
            JSON.stringify(existingSmartlingTranslationsData)
          );
          console.log(
            `✅✅ Downloaded ${incomingTranslationsDir}${locale}.json`
          );
        }
        break;
      case "AWAITING_AUTHORIZATION":
        console.log(
          `⏰ Still ${jobStatus} for translation job, waiting for completion...`
        );
        if (pingCount >= pingsToWaitForAuth) {
          console.log(
            `⏭️ Skipping after ${pingCount} API calls. If still 'Awaiting Authorization' by now, there is probably nothing to translate in this job, and we should have already exited this function.`
          );
          clearInterval(checkJobStatus);
        }
        break;
      case "IN_PROGRESS":
        console.log(
          `🏗️ Translation job still ${jobStatus}, waiting and trying again...`
        );
        break;
      case "CANCELLED":
        console.log(
          `❌ Translation job ${jobStatus} for some reason. Skipping for now. Go to Smartling dashboard for more details.`
        );
        clearInterval(checkJobStatus);
        break;
    }
  }, pingInterval);
})();

// Get a token
async function getSmartlingAuth(url, data) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const result = await response.json();
      return result;
    } else {
      console.error("Error:", response.status, response.statusText);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Get job progress
async function fetchSmartlingData(url, authToken) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const result = await response.json();
      return result;
    } else {
      console.error("Error:", response.status, response.statusText);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

async function generateOutgoingTranslationFile(
  baseFilePath,
  outgoingFilePath,
  pagesToTranslate
) {
  const inputFileData = await readJsonFromFile(baseFilePath);
  const existingSmartlingTranslationsFiles = await fs.promises.readdir(
    "./rosey/smartling-translations"
  );
  const firstExistingSmartlingTranslationsFilePath = path.join(
    "rosey",
    "smartling-translations",
    existingSmartlingTranslationsFiles[0]
  );
  const existingSmartlingTranslations = await readJsonFromFile(
    firstExistingSmartlingTranslationsFilePath
  );
  const existingSmartlingTranslationKeys = Object.keys(
    existingSmartlingTranslations
  );
  // Get all the keys in the base.json
  const inputFileKeyData = inputFileData.keys;
  const inputKeys = Object.keys(inputFileKeyData);
  // Loop through all pages frontmatter so we can get the translations obj
  // Check if the page has any translate_locale set to true and if it does add it to pagesToTranslate
  // When we're looping through the keys check their pages
  // If any of their pages are included in pagesToTranslate, add the key to translationObject like normal
  // If none of their pages are included in pagesToTranslate, don't add the key to translationObject
  // Add a check in the main function where if this object is empty, don't proceed with the smartling call
  // // Otherwise we risk the situation where there is a new translation, but since it's page is excluded
  // // we can't write it to the translationObject and would risk sending away nothing to smartling and having to wait

  const translationObject = {};
  const pagesToTranslateHtmlEquivalent = pagesToTranslate.map((page) => {
    return page
      .replace("pages/", "")
      .replace("index.md", "index.html")
      .replace(".mdx", "/index.html")
      .replace(".md", "/index.html");
  });

  // Looping through base.json keys
  inputKeys.forEach((key) => {
    // If any of their pages are included in pagesToTranslate, add the key to translationObject like normal
    // If none of their pages are included in pagesToTranslate, don't add the key to translationObject
    const keyData = inputFileKeyData[key];
    const keyPageData = keyData.pages;
    const keyPages = Object.keys(keyPageData);
    let translationsPageAllowed = false;
    keyPages.map((page) => {
      if (pagesToTranslateHtmlEquivalent.includes(page)) {
        translationsPageAllowed = true;
      }
    });

    // If we don't already have the translation, add it to the outgoing translations obj
    if (
      !existingSmartlingTranslationKeys.includes(key) &&
      translationsPageAllowed
    ) {
      const originalPhrase = inputFileData.keys[key].original;
      translationObject[key] = originalPhrase;
    }
  });

  await fs.promises.writeFile(
    outgoingFilePath,
    JSON.stringify(translationObject)
  );
  console.log("✅✅ Outgoing translations updated succesfully");
}
