/**
 * Created by vadimdez on 21/06/16.
 */
import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
import {
  PDFProgressData,
  PDFDocumentProxy,
  PDFSource,
  ZoomScale
} from './pdf-viewer/pdf-viewer.module';

import { PdfViewerComponent } from './pdf-viewer/pdf-viewer.component';
import { PDFDataRangeTransport } from 'pdfjs-dist';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import 'pdfjs-dist/build/pdf.worker.entry';

@Component({
  selector: 'pdf-viewer-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  pdfSrc: string | Uint32Array | PDFSource = './assets/pdf-test.pdf';

  error: any;
  page = 1;
  rotation = 0;
  zoom = 1.0;
  zoomScale: ZoomScale = 'page-width';
  originalSize = false;
  pdf: any;
  renderText = true;
  progressData!: PDFProgressData;
  isLoaded = false;
  stickToPage = false;
  showAll = true;
  autoresize = true;
  fitToPage = false;
  outline!: any[];
  isOutlineShown = false;
  pdfQuery = '';
  mobile = false;

  @ViewChild(PdfViewerComponent)
  private pdfComponent!: PdfViewerComponent;

  constructor(
    private http: HttpClient
  ) {
    this.setCustomWorkerPath();
  }

  ngOnInit() {
    if (window.screen.width <= 768) {
      this.mobile = true;
    }

    this.currDoc = './assets/pdf-test.pdf';
    this.downloadFile(this.currDoc, 'Demo');
  }

  // 1 MB
  //DEFAULT_CHUNK_SIZE = 1048576;
  // 5 MB
  //DEFAULT_CHUNK_SIZE = 5242880;
  // TEMP
  DEFAULT_CHUNK_SIZE = 103000000;
  docCaching: Map<string, object> = new Map();
  rangeObj: any = {};
  resetRangeObj() {
    return {
      start: 0,
      end: this.DEFAULT_CHUNK_SIZE,
      fileTotalSize: 0,
      totalChunks: 0,
      chunkCounter: 1,
      chunksList: []
    }
  }

  downloadFile(url: string, name: string) {
    setTimeout(async() => {
      this.rangeObj = this.resetRangeObj();
      await this.downloadChunk(url, name);
    }, 500);
  }
 
  // createBlobToPdf(chunk: any) {
  //   let blob = new Blob([chunk.buffer], { type: 'application/pdf' });
  //   let url = URL.createObjectURL(blob);
  //   // console.log(`Chunk ${this.rangeObj.chunkCounter} blob URL ${url}`);
  //   this.currDoc = url;
  // }

  // base64ToArrayBuffer(base64: any): ArrayBuffer {
  //   let binary_string = window.atob(base64);
  //   let len = binary_string.length;
  //   let bytes = new Uint32Array(len);
  //   for (let i = 0; i < len; i++) {
  //     bytes[i] = binary_string.charCodeAt(i);
  //   }
  //   return bytes.buffer;
  // }

  fileBlob: Uint32Array = new Uint32Array();
  workOnChunk(chunk: any) {
    const emptyUint32Array = new Uint32Array();
    this.rangeObj.chunksList = new Uint32Array([...(this.rangeObj.chunksList || emptyUint32Array), ...chunk]);

  };
  
  fileDownloaded(name: string) { 
    this.fileBlob = this.rangeObj.chunksList;

    this.docCaching.set(name, {
      ...this.rangeObj
    });
  }

  updateRange() {
    const start = this.rangeObj.start + this.DEFAULT_CHUNK_SIZE;
    let end = this.rangeObj.end + this.DEFAULT_CHUNK_SIZE > this.rangeObj.fileTotalSize ? this.rangeObj.fileTotalSize : this.rangeObj.end + this.DEFAULT_CHUNK_SIZE;

    this.rangeObj.start = start;
    this.rangeObj.end = end;
    console.table(this.rangeObj.start, this.rangeObj.end);
  };

  createRangeToDownload() {
    return `bytes=${this.rangeObj.start}-${this.rangeObj.end}`;
  };

  setTotalFileSize(response: any) {
    return +(response.headers.get("content-range") || "/0")?.split('/')[1];
  };

  setTotalChunks() {
    this.rangeObj.totalChunks = Math.ceil(this.rangeObj.fileTotalSize / this.DEFAULT_CHUNK_SIZE);
  };


  verifyDocCachedOrNot(name: string) { 
    return this.docCaching.has(name);
  }

  async downloadChunk(url: string, name: string) {
    if (this.verifyDocCachedOrNot(name)) {
      this.rangeObj = this.docCaching.get(name);
      return;
    }
  
    console.log(`=========  Chunk ${this.rangeObj.chunkCounter}/${this.rangeObj.totalChunks} Download Started  =========`);
  
    try {
      const response = await fetch(url, {
        cache: 'no-cache',
        headers: {
          'Range': this.createRangeToDownload()
        }
      });
  
      if (!this.rangeObj.fileTotalSize) {
        this.rangeObj.fileTotalSize = this.setTotalFileSize(response);
        this.setTotalChunks();
      }
  
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Failed to get reader from response body");
  
      let that = this;
      const stream = new ReadableStream({
        async start(controller) {
          while (true) {
            const { done, value } = await reader.read();
  
            if (done) {
              console.log(`=========  Chunk ${that.rangeObj.chunkCounter}/${that.rangeObj.totalChunks} Download Ended  =========`);
  
              if (that.rangeObj.end === that.rangeObj.fileTotalSize) {
                console.log(`#########      Full File is Downloaded      #########`);
                that.fileDownloaded(name);
                break;
              }
  
              setTimeout(() => {
                that.rangeObj.chunkCounter++;
                that.updateRange();
                that.downloadChunk(url, name);
              }, 150);
              break;
            }
  
            that.workOnChunk(value);
            controller.enqueue(value);
          }
  
          controller.close();
          reader.releaseLock();
        }
      });
  
      const blob = await new Response(stream).blob();
      return blob;
  
    } catch (error) {
      console.error("Error :: =>", error);
      return false;
    }

  }

  // Load pdf
  loadPdf() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', this.currDoc, true);
    xhr.responseType = 'blob';

    xhr.onload = (e: any) => {
      console.log(xhr);
      if (xhr.status === 200) {
        const blob = new Blob([xhr.response], { type: 'application/pdf' });
        this.pdfSrc = URL.createObjectURL(blob);
      }
    };

    xhr.send();
  }

  /**
   * Set custom path to pdf worker
   */
  setCustomWorkerPath() {
    (window as any).pdfWorkerSrc = '/lib/pdfjs-dist/build/pdf.worker.js';
    // (window as any).pdfWorkerSrc = './assets/worker.js.3.2.136';
    // (window as any).pdfWorkerSrc = '../assets/custom-worker.js';
  }

  incrementPage(amount: number) {
    this.page += amount;
  }

  incrementZoom(amount: number) {
    this.zoom += amount;
  }

  rotate(angle: number) {
    this.rotation += angle;
  }

  /**
   * Render PDF preview on selecting file
   */
  onFileSelected() {
    const $pdf: any = document.querySelector('#file');

    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();

      reader.onload = (e: any) => {
        this.pdfSrc = e.target.result;
      };

      reader.readAsArrayBuffer($pdf.files[0]);
    }
  }

  /**
   * Get pdf information after it's loaded
   * @param pdf pdf document proxy
   */
  afterLoadComplete(pdf: PDFDocumentProxy) {
    this.pdf = pdf;

    this.loadOutline();
  }

  /**
   * Get outline
   */
  loadOutline() {
    this.pdf.getOutline().then((outline: any[]) => {
      this.outline = outline;
    });
  }

  /**
   * Handle error callback
   *
   * @param error error message
   */
  onError(error: any) {
    this.error = error; // set error

    if (error.name === 'PasswordException') {
      const password = prompt(
        'This document is password protected. Enter the password:'
      );

      if (password) {
        this.error = null;
        this.setPassword(password);
      }
    }
  }

  setPassword(password: string) {
    let newSrc: PDFSource;

    if (this.pdfSrc instanceof ArrayBuffer) {
      newSrc = { data: this.pdfSrc as any };
      // newSrc = { data: this.pdfSrc };
    } else if (typeof this.pdfSrc === 'string') {
      newSrc = { url: this.pdfSrc };
    } else {
      newSrc = { ...this.pdfSrc };
    }

    newSrc.password = password;

    this.pdfSrc = newSrc;
  }

  /**
   * Pdf loading progress callback
   * @param progressData pdf progress data
   */
  onProgress(progressData: PDFProgressData) {
    this.progressData = progressData;

    this.isLoaded = progressData.loaded >= progressData.total;
    this.error = null; // clear error
  }

  getInt(value: number): number {
    return Math.round(value);
  }

  /**
   * Navigate to destination
   * @param destination pdf navigate to
   */
  navigateTo(destination: any) {
    this.pdfComponent.pdfLinkService.goToDestination(destination);
  }

  /**
   * Scroll view
   */
  scrollToPage() {
    this.pdfComponent.pdfViewer.scrollPageIntoView({
      pageNumber: 3
    });
  }

  /**
   * Page rendered callback, which is called when a page is rendered (called multiple times)
   *
   * @param e custom event
   */
  pageRendered(e: CustomEvent) {
    // console.log('(page-rendered)', e);
  }

  /**
   * Page initialized callback.
   *
   * @param {CustomEvent} e
   */
  pageInitialized(e: CustomEvent) {
    // console.log('(page-initialized)', e);
  }

  /**
   * Page change callback, which is called when a page is changed (called multiple times)
   *
   * @param e number
   */
  pageChange(e: number) {
    // console.log('(page-change)', e);
  }

  searchQueryChanged(newQuery: string) {
    const type = newQuery !== this.pdfQuery ? '' : 'again';
    this.pdfQuery = newQuery;

    this.pdfComponent.eventBus.dispatch('find', {
      type,
      query: this.pdfQuery,
      highlightAll: true,
      caseSensitive: false,
      phraseSearch: true,
      // findPrevious: undefined,
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.mobile = (event.target as Window).innerWidth <= 768;
  }

  options = [
    {
      id: 1,
      name: 'Demo',
      linkSrc: "./assets/pdf-test.pdf"
    },
    {
      id: 13,
      name: 'working_10-mb',
      linkSrc: "https://intcodingplatformsa.blob.core.windows.net/audit-apigateway/not-working-linearized-docs/2320_page_doc_li.pdf?sp=r&st=2024-07-04T04:57:51Z&se=2024-07-04T12:57:51Z&skoid=bce96258-60f5-4742-9ee0-d2bf54bc8fba&sktid=cea08e94-287c-4267-8ce2-7fd5066fc6d5&skt=2024-07-04T04:57:51Z&ske=2024-07-04T12:57:51Z&sks=b&skv=2022-11-02&spr=https&sv=2022-11-02&sr=b&sig=L8a0dsrNPdBKGy%2BLA8jYYKo%2B2e2zgKCPlhH5YjMqJzU%3D"
    },
    {
      id: 11,
      name: 'working_20-mb',
      linkSrc: 'https://intcodingplatformsa.blob.core.windows.net/audit-apigateway/not-working-linearized-docs/1768_page_doc_li.pdf?sp=r&st=2024-07-04T05:00:37Z&se=2024-07-04T13:00:37Z&skoid=bce96258-60f5-4742-9ee0-d2bf54bc8fba&sktid=cea08e94-287c-4267-8ce2-7fd5066fc6d5&skt=2024-07-04T05:00:37Z&ske=2024-07-04T13:00:37Z&sks=b&skv=2022-11-02&spr=https&sv=2022-11-02&sr=b&sig=voUegDB5FrRHvcg%2B7kXyHodT6Yvqob3EBzX45WyJmt0%3D'
    },
    {
      id: 14,
      name: 'working_50-mb',
      linkSrc: "https://intcodingplatformsa.blob.core.windows.net/audit-apigateway/not-working-linearized-docs/2023_Horaida%20Lopez_04.09.1943_8MQ0C92UA31_1718287300713_modified_linearlized_1718298172190.pdf?sp=r&st=2024-07-04T05:01:07Z&se=2024-07-04T13:01:07Z&skoid=bce96258-60f5-4742-9ee0-d2bf54bc8fba&sktid=cea08e94-287c-4267-8ce2-7fd5066fc6d5&skt=2024-07-04T05:01:07Z&ske=2024-07-04T13:01:07Z&sks=b&skv=2022-11-02&spr=https&sv=2022-11-02&sr=b&sig=tLYXgA1cvbWM7AyRQKgHnC0yTHvESwEiIYPAs4k5yPI%3D"
    },
    {
      id: 12,
      name: 'working_100-mb',
      linkSrc: "https://intcodingplatformsa.blob.core.windows.net/audit-apigateway/not-working-linearized-docs/working/100-mb_li.pdf?sp=r&st=2024-07-04T04:59:33Z&se=2024-07-04T12:59:33Z&skoid=bce96258-60f5-4742-9ee0-d2bf54bc8fba&sktid=cea08e94-287c-4267-8ce2-7fd5066fc6d5&skt=2024-07-04T04:59:33Z&ske=2024-07-04T12:59:33Z&sks=b&skv=2022-11-02&spr=https&sv=2022-11-02&sr=b&sig=SibbEi%2Fsjos93f9ZuPptFGCgPZ3b3wCsotGhIbCq3os%3D"
    },
    {
      id: 15,
      name: 'working_270-mb',
      linkSrc: "https://intcodingplatformsa.blob.core.windows.net/audit-apigateway/not-working-linearized-docs/1734_page_doc_li.pdf?sp=r&st=2024-07-04T04:59:13Z&se=2024-07-04T12:59:13Z&skoid=bce96258-60f5-4742-9ee0-d2bf54bc8fba&sktid=cea08e94-287c-4267-8ce2-7fd5066fc6d5&skt=2024-07-04T04:59:13Z&ske=2024-07-04T12:59:13Z&sks=b&skv=2022-11-02&spr=https&sv=2022-11-02&sr=b&sig=qcdNSIRxFT3sFI4VP0NskoQS1iG68UWvtIxZ3ZDz05c%3D"
    }
  ];

  currDoc !: string;
  setDocument(id: any) {
    const currDoc = this.options.filter(value => value.id === parseInt(id))[0] || {
      id: 1,
      name: 'Demo',
      linkSrc: "../files/webviewer-demo-annotated.pdf"
    };

    this.currDoc = currDoc.linkSrc;
    this.downloadFile(this.currDoc, currDoc.name);
  }
}
//   parts: any = [];
//   blob: any;

//   append(part: any) {
//     this.parts.push(part);
//     this.blob = undefined; // Invalidate the blob
//   }

//   getBlob() {
//     if (!this.blob) {
//       this.blob = new Blob(this.parts, {
//         type: 'application/pdf'
//       });
//     }
//     return this.blob;
//   }
// }

// Custom initialization logic, if needed
// For example:
// CustomPDFWorker.prototype.initWorker = function() { ... };

// Extend the default PDFWorker
// class CustomPDFWorker extends pdfjsLib.PDFWorker {
//   // Override the message handler to manipulate chunk sequence
//   override messageHandler(data: any) {
//     if (data?.pdfDataRange) {
//       // Manipulate the sequence of PDF data chunks as needed
//       const { begin, chunk } = data.pdfDataRange;
//       // Your custom logic to handle the PDF data chunks
//     } else {
//       // Call the default message handler for other messages
//       super.messageHandler(data);
//     }
//   }
// }


// export default CustomPDFWorker;