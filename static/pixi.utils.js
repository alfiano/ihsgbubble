class PixiUtils {
  static createGradientTexture(radius, color) {
    // Create a circular gradient texture for PIXI
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = radius * 2;
    canvas.height = radius * 2;

    const gradient = context.createRadialGradient(radius, radius, 0, radius, radius, radius);
    if (color === 'green') {
      gradient.addColorStop(0.5, 'rgba(0, 255, 0, 0.1)'); // Transparent center
      gradient.addColorStop(0.7, 'rgba(0, 200, 0, 0.2)'); // Semi-transparent middle
      gradient.addColorStop(1, 'rgba(172, 211, 125, 0.8)'); // More opaque edge
    } else {
      gradient.addColorStop(0.5, 'rgba(255, 0, 0, 0.1)'); // Transparent center
      gradient.addColorStop(0.7, 'rgba(200, 0, 0, 0.2)'); // Semi-transparent middle
      gradient.addColorStop(1, 'rgba(100, 0, 0, 0.8)'); // More opaque edge
    }

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(radius, radius, radius, 0, Math.PI * 2);
    context.fill();
    
    return PIXI.Texture.from(canvas);
  }

  static createText2(circleData, bubbleSort) {
    // For IHSG data, use change_pct directly
    const percentage = circleData.change_pct;
    return percentage !== undefined && percentage !== null ? 
      `${(percentage).toFixed(2)}%` : 
      'N/A';
  }
}

// Export if using modules, or ensure PixiUtils is global for direct script includes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PixiUtils };
} else {
  window.PixiUtils = PixiUtils;
}
