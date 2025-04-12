import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface MarshmallowCloudsAndRainbowsProps {
  className?: string;
}

export const MarshmallowCloudsAndRainbows: React.FC<MarshmallowCloudsAndRainbowsProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const cloudsRef = useRef<Cloud[]>([]);
  const rainbowsRef = useRef<Rainbow[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, moving: false });
  
  interface Cloud {
    x: number;
    y: number;
    radius: number;
    color: string;
    speed: number;
    opacity: number;
    scale: number;
    rotation: number;
    rotationSpeed: number;
    wobbleAmount: number;
    wobbleSpeed: number;
    wobbleOffset: number;
    blobs: Blob[];
  }
  
  interface Blob {
    offsetX: number;
    offsetY: number;
    radius: number;
    color: string;
  }
  
  interface Rainbow {
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number;
    amplitude: number;
    frequency: number;
    phase: number;
    thickness: number;
    opacity: number;
    colors: string[];
  }
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Track mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX,
        y: e.clientY,
        moving: true
      };
      
      // Create new cloud occasionally on mouse move
      if (Math.random() > 0.97) {
        createCloud(e.clientX, e.clientY);
      }
      
      // Create new rainbow occasionally on mouse move
      if (Math.random() > 0.98) {
        createRainbow(e.clientX, e.clientY);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    // Reset mouse moving flag after a delay
    let timeout: NodeJS.Timeout;
    const handleMouseStop = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        mouseRef.current.moving = false;
      }, 100);
    };
    
    window.addEventListener('mousemove', handleMouseStop);
    
    // Create a marshmallow cloud
    const createCloud = (x: number, y: number) => {
      // Generate pastel color
      const hue = Math.random() * 60 + 320; // Pink to purple range
      const saturation = Math.random() * 20 + 10; // Low saturation for pastel
      const lightness = Math.random() * 20 + 75; // High lightness for pastel
      const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      
      // Create blobs for the cloud
      const blobCount = Math.floor(Math.random() * 3) + 3;
      const blobs: Blob[] = [];
      
      for (let i = 0; i < blobCount; i++) {
        // Slightly different color for each blob
        const blobHue = hue + (Math.random() * 20 - 10);
        const blobSaturation = saturation + (Math.random() * 10 - 5);
        const blobLightness = lightness + (Math.random() * 10 - 5);
        const blobColor = `hsl(${blobHue}, ${blobSaturation}%, ${blobLightness}%)`;
        
        blobs.push({
          offsetX: (Math.random() * 2 - 1) * 20,
          offsetY: (Math.random() * 2 - 1) * 20,
          radius: Math.random() * 30 + 20,
          color: blobColor
        });
      }
      
      const cloud = {
        x,
        y,
        radius: Math.random() * 30 + 40,
        color,
        speed: Math.random() * 1 + 0.5,
        opacity: Math.random() * 0.3 + 0.2,
        scale: Math.random() * 0.5 + 0.8,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() * 0.02 - 0.01) * 0.3,
        wobbleAmount: Math.random() * 10 + 5,
        wobbleSpeed: Math.random() * 0.05 + 0.02,
        wobbleOffset: Math.random() * Math.PI * 2,
        blobs
      };
      
      cloudsRef.current.push(cloud);
      
      // Limit the number of clouds
      if (cloudsRef.current.length > 15) {
        cloudsRef.current.shift();
      }
    };
    
    // Create a rainbow
    const createRainbow = (x: number, y: number) => {
      // Rainbow colors
      const colors = [
        'rgba(255, 0, 0, 0.7)',    // Red
        'rgba(255, 165, 0, 0.7)',  // Orange
        'rgba(255, 255, 0, 0.7)',  // Yellow
        'rgba(0, 255, 0, 0.7)',    // Green
        'rgba(0, 165, 255, 0.7)',  // Blue
        'rgba(75, 0, 130, 0.7)',   // Indigo
        'rgba(238, 130, 238, 0.7)' // Violet
      ];
      
      const rainbow = {
        x,
        y: y - 100 + Math.random() * 200,
        width: Math.random() * 300 + 200,
        height: Math.random() * 100 + 50,
        speed: Math.random() * 2 + 1,
        amplitude: Math.random() * 50 + 20,
        frequency: Math.random() * 0.02 + 0.01,
        phase: Math.random() * Math.PI * 2,
        thickness: Math.random() * 10 + 5,
        opacity: Math.random() * 0.3 + 0.2,
        colors
      };
      
      rainbowsRef.current.push(rainbow);
      
      // Limit the number of rainbows
      if (rainbowsRef.current.length > 5) {
        rainbowsRef.current.shift();
      }
    };
    
    // Create initial clouds and rainbows
    for (let i = 0; i < 5; i++) {
      createCloud(
        Math.random() * canvas.width,
        Math.random() * canvas.height
      );
      
      if (i < 2) {
        createRainbow(
          Math.random() * canvas.width,
          Math.random() * canvas.height
        );
      }
    }
    
    // Animation loop
    const animate = () => {
      // Apply a semi-transparent clear to create trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw rainbows
      rainbowsRef.current.forEach((rainbow, index) => {
        // Move rainbow
        rainbow.x -= rainbow.speed;
        rainbow.phase += 0.02;
        
        // Remove rainbows that have moved off-screen
        if (rainbow.x + rainbow.width < -100) {
          rainbowsRef.current.splice(index, 1);
          
          // Create a new rainbow if mouse is moving
          if (mouseRef.current.moving) {
            createRainbow(
              canvas.width + 100,
              Math.random() * canvas.height
            );
          }
          return;
        }
        
        // Draw rainbow
        const bandHeight = rainbow.thickness;
        
        rainbow.colors.forEach((color, colorIndex) => {
          ctx.beginPath();
          
          // Create a wavy path for the rainbow
          ctx.moveTo(rainbow.x, rainbow.y + Math.sin(rainbow.phase + rainbow.x * rainbow.frequency) * rainbow.amplitude);
          
          for (let x = 0; x <= rainbow.width; x += 10) {
            const wavy = Math.sin((rainbow.phase + (rainbow.x + x) * rainbow.frequency)) * rainbow.amplitude;
            ctx.lineTo(rainbow.x + x, rainbow.y + wavy + colorIndex * bandHeight);
          }
          
          for (let x = rainbow.width; x >= 0; x -= 10) {
            const wavy = Math.sin((rainbow.phase + (rainbow.x + x) * rainbow.frequency)) * rainbow.amplitude;
            ctx.lineTo(rainbow.x + x, rainbow.y + wavy + (colorIndex + 1) * bandHeight);
          }
          
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.globalAlpha = rainbow.opacity;
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      });
      
      // Update and draw clouds
      cloudsRef.current.forEach((cloud, index) => {
        // Move cloud
        cloud.x -= cloud.speed;
        cloud.y += Math.sin(cloud.wobbleOffset) * 0.5;
        cloud.wobbleOffset += cloud.wobbleSpeed;
        cloud.rotation += cloud.rotationSpeed;
        
        // Remove clouds that have moved off-screen
        if (cloud.x + cloud.radius < -100) {
          cloudsRef.current.splice(index, 1);
          
          // Create a new cloud if mouse is moving
          if (mouseRef.current.moving) {
            createCloud(
              canvas.width + 100,
              Math.random() * canvas.height
            );
          }
          return;
        }
        
        // Draw cloud
        ctx.save();
        ctx.translate(cloud.x, cloud.y);
        ctx.rotate(cloud.rotation);
        ctx.scale(cloud.scale, cloud.scale);
        
        // Draw main cloud body
        ctx.beginPath();
        ctx.arc(0, 0, cloud.radius, 0, Math.PI * 2);
        ctx.fillStyle = cloud.color;
        ctx.globalAlpha = cloud.opacity;
        ctx.fill();
        
        // Draw blobs to create fluffy appearance
        cloud.blobs.forEach(blob => {
          ctx.beginPath();
          ctx.arc(
            blob.offsetX + Math.sin(cloud.wobbleOffset + blob.offsetX) * cloud.wobbleAmount * 0.1,
            blob.offsetY + Math.cos(cloud.wobbleOffset + blob.offsetY) * cloud.wobbleAmount * 0.1,
            blob.radius,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = blob.color;
          ctx.fill();
        });
        
        ctx.globalAlpha = 1;
        ctx.restore();
        
        // Create new cloud occasionally
        if (Math.random() > 0.997) {
          createCloud(
            canvas.width + 100,
            Math.random() * canvas.height
          );
        }
        
        // Create new rainbow occasionally
        if (Math.random() > 0.998) {
          createRainbow(
            canvas.width + 100,
            Math.random() * canvas.height
          );
        }
      });
      
      frameRef.current = requestAnimationFrame(animate);
    };
    
    frameRef.current = requestAnimationFrame(animate);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousemove', handleMouseStop);
      cancelAnimationFrame(frameRef.current);
      clearTimeout(timeout);
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ pointerEvents: 'none' }}
    />
  );
};

export default MarshmallowCloudsAndRainbows;
