// "use client"; // Not needed for plain JS in browser
// import * as PIXI from "pixi.js"; // PIXI is global via CDN

// import { Circle, PriceChangePercentage } from "@/types/bubbles.types"; // Types removed for plain JS
// import { CoingeckoCoinData } from "@/types/coingecko.type"; // Types removed for plain JS
// import { PixiUtils } from "./pixi.utils"; // PixiUtils will be global or accessible if loaded first

// Define PriceChangePercentage enum locally if not available globally
const PriceChangePercentage = {
  HOUR: 'price_change_percentage_1h_in_currency',
  DAY: 'price_change_percentage_24h_in_currency',
  WEEK: 'price_change_percentage_7d_in_currency',
  MONTH: 'price_change_percentage_30d_in_currency',
  YEAR: 'price_change_percentage_1y_in_currency',
};

const appConfig = {
  width: typeof window !== "undefined" ? window.innerWidth - 16 : 100,
  height: typeof window !== "undefined" ? window.innerHeight * 0.84 : 100,
  speed: 0.005,
  elasticity: 0.005,
  wallDamping: 0.5,
  maxCircleSize: 250,
  minCircleSize: typeof window !== "undefined" ? (window.innerWidth ? (window.innerWidth > 920 ? 30 : 15) : 15) : 15,
};
const { wallDamping, width, height, speed, elasticity, maxCircleSize, minCircleSize } = appConfig;

const changeSizeStep = 2;

class BubblesUtils {
  static getScalingFactor = (data, bubbleSort = PriceChangePercentage.HOUR) => {
    console.log('BubblesUtils: Calculating scaling factor for', data.length, 'items with sort type:', bubbleSort);
    
    if (!data || data.length === 0) return 1;
    
    const hasData = data.some(item => typeof item[bubbleSort] === 'number');
    console.log('BubblesUtils: Data has price change percentages:', hasData);
    
    if (!hasData) {
      console.warn('BubblesUtils: No price change percentage data found in items for sort:', bubbleSort);
      console.log('BubblesUtils: First few items:', data.slice(0, 3));
      return 5; 
    }
    
    const values = data.map((item) => Math.abs(item[bubbleSort] || 0));
    // console.log('BubblesUtils: Price change values sample:', values.slice(0, 5));
    
    let totalSquare = 0;
    for (let i = 0; i < values.length; i++) {
      // Use the value directly as it represents percentage, not radius yet
      const area = Math.PI * values[i] * values[i]; 
      totalSquare += area;
    }

    if (totalSquare === 0) {
        console.warn('BubblesUtils: Total square area is zero, implies all price changes are zero. Defaulting scaling factor.');
        return 5; // Avoid division by zero and provide a default
    }

    // Adjust appConfig width/height if they are too small
    const currentWidth = typeof window !== "undefined" ? window.innerWidth - 16 : appConfig.width;
    const currentHeight = typeof window !== "undefined" ? window.innerHeight * 0.84 : appConfig.height;

    const scalingFactor = Math.sqrt((currentWidth * currentHeight) / totalSquare) * (currentWidth > 920 ? 0.8 : 0.5);
    console.log('BubblesUtils: Calculated scaling factor:', scalingFactor);
    return scalingFactor;
  };

  static update = (circles, imageSprites, textSprites, text2Sprites, circleGraphics = []) => {
    // Ensure appConfig dimensions are up-to-date if window is defined
    const currentWidth = typeof window !== "undefined" ? window.innerWidth - 16 : appConfig.width;
    const currentHeight = typeof window !== "undefined" ? window.innerHeight * 0.84 : appConfig.height;

    return () => {
      for (let i = 0; i < circles.length; i++) {
        const circle = circles[i];
        const circleGraphic = circleGraphics[i];
        const text = textSprites[i];
        const text2 = text2Sprites[i];

        const updateCircleChilds = () => {
          if (PixiUtils && PixiUtils.createGradientTexture) {
             // Ensure texture is updated only if radius changes significantly or first time
            if (circleGraphic.tag !== circle.radius || !circleGraphic.tag) {
                circleGraphic.texture = PixiUtils.createGradientTexture(circle.radius, circle.color);
                circleGraphic.width = circle.radius * 2;
                circleGraphic.height = circle.radius * 2;
                circleGraphic.tag = circle.radius; // Store current radius to compare
            }
          } else {
            // Fallback if PixiUtils or createGradientTexture is not available
            // This part would be hit if pixi.utils.js isn't loaded or PixiUtils isn't global
            // For now, let's assume it's a simple PIXI.Graphics circle
            circleGraphic.clear();
            circleGraphic.beginFill(circle.color === "green" ? 0x00FF00 : 0xFF0000, 0.8);
            circleGraphic.drawCircle(0, 0, circle.radius);
            circleGraphic.endFill();
          }

          // Always make text visible regardless of bubble size
          const fontSize = Math.max(10, circle.radius * 0.4); // Minimum font size of 10px

          const textStyle = new PIXI.TextStyle({
            fontSize: fontSize,
            fill: "#ffffff",
            align: 'center',
            fontWeight: 'bold',
            wordWrap: true, // Added for better text handling
            wordWrapWidth: Math.max(circle.radius * 1.8, 30) // Ensure minimum width for text
          });

          const text2Style = new PIXI.TextStyle({
            fontSize: Math.max(8, fontSize * 0.7), // Ensure minimum size for price change text
            fill: "#ffffff",
            align: 'center'
          });

          text.style = textStyle;
          text.anchor.set(0.5);
          text.position.set(0, -circle.radius * 0.1); // Adjusted for centering

          text2.style = text2Style;
          text2.anchor.set(0.5);
          text2.position.set(0, circle.radius * 0.5); // Adjusted for centering
        };

        circle.x += circle.vx;
        circle.y += circle.vy;

        if (circle.x - circle.radius < 0) {
          circle.x = circle.radius;
          circle.vx *= -1;
          circle.vx *= 1 - appConfig.wallDamping;
        } else if (circle.x + circle.radius > currentWidth) {
          circle.x = currentWidth - circle.radius;
          circle.vx *= -1;
          circle.vx *= 1 - appConfig.wallDamping;
        }
        if (circle.y - circle.radius < 0) {
          circle.y = circle.radius;
          circle.vy *= -1;
          circle.vy *= 1 - appConfig.wallDamping;
        } else if (circle.y + circle.radius > currentHeight) {
          circle.y = currentHeight - circle.radius;
          circle.vy *= -1;
          circle.vy *= 1 - appConfig.wallDamping;
        }

        for (let j = i + 1; j < circles.length; j++) {
          const otherCircle = circles[j];
          const dx = otherCircle.x - circle.x;
          const dy = otherCircle.y - circle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < circle.radius + otherCircle.radius) {
            const angle = Math.atan2(dy, dx);
            const totalRadius = circle.radius + otherCircle.radius;
            const overlap = totalRadius - distance;
            const force = overlap * appConfig.elasticity;

            circle.vx -= force * Math.cos(angle) * appConfig.wallDamping + circle.vx * 0.01;
            circle.vy -= force * Math.sin(angle) * appConfig.wallDamping + circle.vy * 0.01;
            otherCircle.vx += force * Math.cos(angle) * appConfig.wallDamping;
            otherCircle.vy += force * Math.sin(angle) * appConfig.wallDamping;
          }
        }

        const container = circleGraphic.parent;
        if (container) {
            container.position.set(circle.x, circle.y);
        }
        
        if (circle.radius !== circle.targetRadius) {
          if(container) container.cacheAsBitmap = false;

          const sizeDifference = circle.targetRadius - circle.radius;
          if (Math.abs(sizeDifference) <= changeSizeStep) {
            circle.radius = circle.targetRadius;
            if(container) container.cacheAsBitmap = true;
          } else {
            circle.radius += sizeDifference > 0 ? changeSizeStep : -changeSizeStep;
          }
          updateCircleChilds(); // Update appearance when radius changes
        } else {
            // If radius is stable, ensure childs are updated at least once
            if (!circle.initialUpdateDone) {
                updateCircleChilds();
                circle.initialUpdateDone = true;
            }
        }
      }
    };
  };

  static handleEmptySpaceClick = (event, circles, app) => {
    const waveForce = 15; // Reduced force for less chaotic effect
    
    // Get correct click coordinates based on whether event is a PIXI event or regular MouseEvent
    let clickX, clickY;
    
    if (event.clientX !== undefined) {
      // Regular MouseEvent
      const rect = app.view.getBoundingClientRect();
      clickX = event.clientX - rect.left;
      clickY = event.clientY - rect.top;
    } else {
      // PIXI event (event.data.global)
      clickX = event.x;
      clickY = event.y;
    }
    
    // Safety check to ensure coordinates are within bounds
    if (isNaN(clickX) || isNaN(clickY)) {
      console.warn('BubblesUtils: Invalid click coordinates', clickX, clickY);
      return; // Exit if coordinates are invalid
    }
    
    console.log('BubblesUtils: Empty space click at', clickX, clickY);
    
    // Apply force to each circle
    circles.forEach((circle) => {
      const dx = circle.x - clickX;
      const dy = circle.y - clickY;
      let distance = Math.sqrt(dx * dx + dy * dy);
      
      // Avoid division by zero and limit maximum force for very close clicks
      if (distance < 1) distance = 1;
      
      // Calculate angle from circle to click point
      const angle = Math.atan2(dy, dx);
      
      // Apply force inversely proportional to distance
      // Limit maximum force to prevent bubbles from flying off screen
      const force = Math.min(waveForce / distance, 5);
      
      circle.vx += force * Math.cos(angle);
      circle.vy += force * Math.sin(angle);
    });
  };

  static handleMouseMove = (event, circles, app) => {
    const index = circles.findIndex((circle) => circle.dragging);
    if (index !== -1) {
      const circle = circles[index];
      const rect = app.view.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const dx = mouseX - circle.x;
      const dy = mouseY - circle.y;
      // Move directly for smoother dragging, physics will resolve overlap
      // circle.x = mouseX;
      // circle.y = mouseY;
      // OR apply velocity
      const distance = Math.sqrt(dx * dx + dy * dy);
      const moveSpeed = 0.2; // Adjust for responsiveness
      if (distance > 1) { // Only apply if not already at target
        circle.vx = dx * moveSpeed;
        circle.vy = dy * moveSpeed;
      }
    }
  };

  static generateCircles = (coins, scalingFactor, bubbleSort = 'change_pct') => {
    console.log('BubblesUtils: Generating circles with scaling factor:', scalingFactor, 'Bubble sort:', bubbleSort);
    // Ensure appConfig dimensions are up-to-date if window is defined
    const currentWidth = typeof window !== "undefined" ? window.innerWidth - 16 : appConfig.width;
    const currentHeight = typeof window !== "undefined" ? window.innerHeight * 0.84 : appConfig.height;
    
    const shapes = coins.map((item) => {
      // For IHSG data, use change_pct as the primary value
      const priceChangeValue = item.change_pct || 0;
      console.log('BubblesUtils: Item:', item.ticker, 'Price change value:', priceChangeValue);
      
      let radius = Math.abs(priceChangeValue * scalingFactor);
      console.log('BubblesUtils: Initial radius for', item.ticker, ':', radius);

      const targetRadius = Math.max(appConfig.minCircleSize, Math.min(radius, appConfig.maxCircleSize));
      console.log('BubblesUtils: Target radius for', item.ticker, ':', targetRadius);

      // Remove .jk or .JK suffix from ticker if present
      const cleanTicker = item.ticker ? item.ticker.replace(/\.JK$/i, '') : 'N/A';
      
      const data = {
        id: item.ticker, // Keep original ticker as ID for data lookup
        symbol: cleanTicker, // Use cleaned ticker as the symbol for display
        image: null, // IHSG data doesn't have images
        coinName: cleanTicker, // Use cleaned ticker as the name
        x: Math.random() * (currentWidth - targetRadius * 2) + targetRadius,
        y: Math.random() * (currentHeight - targetRadius * 2) + targetRadius,
        vx: (Math.random() * appConfig.speed * 2 - appConfig.speed) * 50, // Slightly increased initial speed
        vy: (Math.random() * appConfig.speed * 2 - appConfig.speed) * 50,
        color: priceChangeValue >= 0 ? "green" : "red",
        targetRadius: targetRadius,
        radius: appConfig.minCircleSize, // Start small and grow
        dragging: false,
        // Store the price change percentage for display
        change_pct: item.change_pct,
        // Store close prices for display in tooltip
        close_price: item.close_today,
        yesterday_close_price: item.yesterday_close_price || item.close_yesterday
      };

      const shape = { ...data, text2: PixiUtils.createText2(data, bubbleSort) };
      return shape;
    });
    console.log("Generated shapes:", shapes.slice(0,2));
    return shapes;
  };
}

// Export if using modules, or ensure BubblesUtils is global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BubblesUtils, appConfig, PriceChangePercentage };
} else {
  window.BubblesUtils = BubblesUtils;
  window.appConfig = appConfig; // Make appConfig global too for easy access from HTML script
  window.PriceChangePercentage = PriceChangePercentage; // And PriceChangePercentage
}
