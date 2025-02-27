import { defineCollection, z } from "astro:content";

const seoSchema = z
  .object({
    page_description: z.string().nullable(),
    canonical_url: z.string().nullable(),
    featured_image: z.string().nullable(),
    featured_image_alt: z.string().nullable(),
    author_twitter_handle: z.string().nullable(),
    open_graph_type: z.string().nullable(),
    no_index: z.boolean(),
  })
  .optional();

const translationSchema = z
  .object({
    translate_es_ES: z.boolean(),
    url_translation_es_ES: z.string(),
    translate_de_DE: z.boolean(),
    url_translation_de_DE: z.string(),
    translate_fr_FR: z.boolean(),
    url_translation_fr_FR: z.string(),
  })
  .optional();

const visualEditorTranslationSchema = z
  .object({
    selected_page_translation: z.string(),
    translate_es_ES: z.boolean(),
    url_translation_es_ES: z.string(),
    translate_de_DE: z.boolean(),
    url_translation_de_DE: z.string(),
    translate_fr_FR: z.boolean(),
    url_translation_fr_FR: z.string(),
  })
  .optional();

const blogCollection = defineCollection({
  schema: z.object({
    date: z.string().or(z.date()),
    title: z.string(),
    tags: z.array(z.string()),
    author: z.string(),
    thumb_image_path: z.string(),
    thumb_image_alt: z.string(),
    image: z.string(),
    image_alt: z.string(),
    seo: seoSchema,
    translations: translationSchema,
  }),
});

const pageSchema = z.object({
  title: z.string(),
  content_blocks: z.array(z.any()),
  translations: visualEditorTranslationSchema,
  seo: seoSchema,
});

const paginatedCollectionSchema = z.object({
  title: z.string(),
  page_size: z.number().positive(),
  translations: translationSchema,
  seo: seoSchema,
});

const pagesCollection = defineCollection({
  schema: z.union([paginatedCollectionSchema, pageSchema]),
});

export const collections = {
  blog: blogCollection,
  pages: pagesCollection,
};
