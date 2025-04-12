import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { Mail, Twitter, Github, Linkedin, Instagram } from 'lucide-react';

export const FluidFooter: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return;
    
    const container = containerRef.current;
    const content = contentRef.current;
    
    // Create 3D perspective effect
    const handleMouseMove = (e: MouseEvent) => {
      const { left, top, width, height } = container.getBoundingClientRect();
      const x = (e.clientX - left) / width - 0.5;
      const y = (e.clientY - top) / height - 0.5;
      
      // Apply subtle rotation based on mouse position
      gsap.to(content, {
        rotationY: x * 3,
        rotationX: -y * 3,
        transformPerspective: 1000,
        duration: 0.5,
        ease: 'power2.out'
      });
      
      // Move elements with different intensities
      const layers = container.querySelectorAll('.footer-layer');
      layers.forEach((layer) => {
        const depth = parseFloat((layer as HTMLElement).dataset.depth || '1');
        gsap.to(layer, {
          x: x * 15 * depth,
          y: y * 10 * depth,
          duration: 0.5,
          ease: 'power2.out'
        });
      });
    };
    
    const handleMouseLeave = () => {
      gsap.to(content, {
        rotationY: 0,
        rotationX: 0,
        duration: 0.7,
        ease: 'elastic.out(1, 0.3)'
      });
      
      const layers = container.querySelectorAll('.footer-layer');
      layers.forEach((layer) => {
        gsap.to(layer, {
          x: 0,
          y: 0,
          duration: 0.7,
          ease: 'elastic.out(1, 0.3)'
        });
      });
    };
    
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);
  
  const socialLinks = [
    { icon: <Twitter className="w-5 h-5" />, href: "#", label: "Twitter" },
    { icon: <Github className="w-5 h-5" />, href: "#", label: "GitHub" },
    { icon: <Linkedin className="w-5 h-5" />, href: "#", label: "LinkedIn" },
    { icon: <Instagram className="w-5 h-5" />, href: "#", label: "Instagram" },
    { icon: <Mail className="w-5 h-5" />, href: "#", label: "Email" }
  ];
  
  const footerLinks = [
    { title: "Company", links: ["About", "Careers", "Blog", "Press"] },
    { title: "Product", links: ["Features", "Pricing", "API", "Integrations"] },
    { title: "Resources", links: ["Documentation", "Guides", "Support", "Status"] },
    { title: "Legal", links: ["Privacy", "Terms", "Security", "Cookies"] }
  ];
  
  return (
    <div 
      ref={containerRef}
      className="relative py-16 overflow-hidden"
    >
      {/* Background elements */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-neon-magenta/5 blur-3xl footer-layer" data-depth="2" />
      <div className="absolute -bottom-20 -right-20 w-60 h-60 rounded-full bg-neon-cyan/5 blur-3xl footer-layer" data-depth="1.5" />
      
      <div 
        ref={contentRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Logo and description */}
          <div className="lg:col-span-2 footer-layer" data-depth="0.5">
            <div className="text-2xl font-bold gradient-text mb-4">GIGAntic</div>
            <p className="text-gray-400 mb-6 max-w-md">
              Transforming trading with AI-powered strategies. Let our platform handle the complexity while you focus on your financial goals.
            </p>
            
            {/* Social links */}
            <div className="flex space-x-4 mb-8">
              {socialLinks.map((link, index) => (
                <motion.a
                  key={index}
                  href={link.href}
                  whileHover={{ scale: 1.1, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                  aria-label={link.label}
                >
                  {link.icon}
                </motion.a>
              ))}
            </div>
          </div>
          
          {/* Footer links */}
          {footerLinks.map((section, index) => (
            <div 
              key={index}
              className="footer-layer"
              data-depth={1 + index * 0.1}
            >
              <h3 className="text-white font-medium mb-4">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <motion.a
                      href="#"
                      whileHover={{ x: 3 }}
                      className="text-gray-400 hover:text-neon-cyan transition-colors inline-block"
                    >
                      {link}
                    </motion.a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center footer-layer" data-depth="0.3">
          <p className="text-gray-500 text-sm mb-4 md:mb-0">
            © {new Date().getFullYear()} GIGAntic. All rights reserved.
          </p>
          
          <div className="flex space-x-6">
            <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
              Terms of Service
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FluidFooter;
