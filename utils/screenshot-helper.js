/**
 * Scrappey Bot Detector - Screenshot Helper
 * Lightweight screenshot functionality using canvas API
 */

const ScreenshotHelper = {
  /**
   * Capture element as image using canvas
   */
  async captureElement(element, options = {}) {
    const {
      backgroundColor = '#0C1222',
      scale = 2,
      width = null,
      height = null
    } = options;

    // Use html2canvas if available, otherwise fallback to simple canvas
    if (typeof html2canvas !== 'undefined') {
      return await html2canvas(element, {
        backgroundColor: backgroundColor,
        scale: scale,
        logging: false,
        useCORS: true,
        allowTaint: false,
        width: width || element.scrollWidth,
        height: height || element.scrollHeight
      });
    }

    // Fallback: Create a simple canvas representation
    // This is a basic implementation - html2canvas provides better results
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const elemWidth = width || element.scrollWidth || element.offsetWidth;
    const elemHeight = height || element.scrollHeight || element.offsetHeight;
    
    canvas.width = elemWidth * scale;
    canvas.height = elemHeight * scale;
    
    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Note: This is a simplified version
    // For full functionality, html2canvas should be included
    console.warn('[Scrappey] html2canvas not loaded, using basic canvas');
    
    return canvas;
  },

  /**
   * Download canvas as PNG
   */
  downloadCanvas(canvas, filename) {
    canvas.toBlob((blob) => {
      if (!blob) {
        throw new Error('Failed to create image blob');
      }
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 100);
    }, 'image/png', 0.95);
  }
};

// Export
if (typeof window !== 'undefined') {
  window.ScreenshotHelper = ScreenshotHelper;
}

