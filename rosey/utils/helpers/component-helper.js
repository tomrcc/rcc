import { formatAndSlugifyMarkdownText } from "./markdown-formatters.js";
const locales = ["es-ES", "de-DE", "fr-FR"];

export function generateRoseyID(data) {
  let text = "";
  if (!data) {
    return "";
  }
  if (typeof data === "object" && data.original) {
    text = data.original;
  }
  if (typeof data === "string") {
    text = data;
  }

  return formatAndSlugifyMarkdownText(text);
}

export function generateRoseyMarkdownID(text) {
  if (!text) {
    return "";
  }

  return `markdown:${formatAndSlugifyMarkdownText(text)}`;
}

export function selectRoseyTranslation(translations_object, translationData) {
  let textToShow = "";
  locales.map((locale) => {
    if (locale === translationData.selected_page_translation) {
      textToShow =
        translations_object[`${locale.replace("-", "_")}_translation`];
    }
  });
  return translationData.bookshop_env
    ? translationData.selected_page_translation === "None"
      ? translations_object.original
      : textToShow
    : translations_object.original;
}
