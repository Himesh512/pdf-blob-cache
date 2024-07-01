declare module 'pdfjs-dist/build/pdf' {
  // Define your types or interfaces here
  // For example:
  export interface PDFWorkerParams {
    workerPort?: MessagePort | null;
    verbosity?: number | null;
  }

  export class PDFWorker {
    ready: any;
    constructor(params?: PDFWorkerParams);
    messageHandler(data: any): void;
    destroy(): void;
    static fromPort(params: PDFWorkerParams): PDFWorker;
  }
}