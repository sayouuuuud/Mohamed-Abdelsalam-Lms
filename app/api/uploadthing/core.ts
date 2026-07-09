import { createUploadthing, type FileRouter } from 'uploadthing/next'

const f = createUploadthing()

export const ourFileRouter = {
  receiptUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.url };
    }),
  // Curriculum artwork (stages / branches / lectures) uploaded from admin.
  curriculumImage: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .onUploadComplete(async ({ file }) => {
      return { url: file.url };
    }),
  // Lesson video uploaded from admin lesson editor.
  lessonVideo: f({ video: { maxFileSize: "512MB", maxFileCount: 1 } })
    .onUploadComplete(async ({ file }) => {
      return { url: file.url };
    }),
  // Lesson attachments (PDF, Word, images, etc.) uploaded from admin lesson editor.
  // UploadThing only allows power-of-two sizes, so the endpoint cap is 128MB while
  // the client enforces the intended 100MB per-file limit.
  lessonAttachment: f({ blob: { maxFileSize: "128MB", maxFileCount: 10 } })
    .onUploadComplete(async ({ file }) => {
      return { url: file.url, name: file.name };
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
