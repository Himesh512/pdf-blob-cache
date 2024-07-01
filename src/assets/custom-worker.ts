import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import 'pdfjs-dist/build/pdf.worker.entry';

// Custom initialization logic, if needed
// For example:
// CustomPDFWorker.prototype.initWorker = function() { ... };

// Extend the default PDFWorker
class CustomPDFWorker extends pdfjsLib.PDFWorker {
  // Override the message handler to manipulate chunk sequence
  messageHandler(data) {
    if (data?.pdfDataRange) {
      // Manipulate the sequence of PDF data chunks as needed
      const { begin, chunk } = data.pdfDataRange;
      // Your custom logic to handle the PDF data chunks
    } else {
      // Call the default message handler for other messages
      super.messageHandler(data);
    }
  }
}


export default CustomPDFWorker;