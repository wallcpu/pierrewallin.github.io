/* ============================================
   ARTISTIC PERSONAL WEBSITE - MAIN.JS
   Clean, Minimal JavaScript for Interactivity
   ============================================ */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize all features
  initNavigation();
  initScrollEffects();
  initProjectModal();
  initPortfolioFilter();
  initPageTransitions();
  initScrollReveal();
});

/* ---------- Navigation ---------- */
function initNavigation() {
  const nav = document.querySelector('.nav');
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  const navLinkItems = document.querySelectorAll('.nav-link');

  // Mobile menu toggle
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      navToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
      document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
    });
  }

  // Close mobile menu when clicking a link
  navLinkItems.forEach(link => {
    link.addEventListener('click', () => {
      navToggle?.classList.remove('active');
      navLinks?.classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  // Scroll effect for navigation
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    // Add scrolled class for background
    if (currentScroll > 50) {
      nav?.classList.add('scrolled');
    } else {
      nav?.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
  });

  // Set active link based on current page
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  navLinkItems.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

/* ---------- Scroll Effects ---------- */
function initScrollEffects() {
  // Parallax effect for floating shapes
  const shapes = document.querySelectorAll('.shape');

  if (shapes.length > 0) {
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;

      shapes.forEach((shape, index) => {
        const speed = 0.1 + (index * 0.05);
        shape.style.transform = `translateY(${scrolled * speed}px)`;
      });
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

/* ---------- Project Modal ---------- */
function initProjectModal() {
  const modal = document.querySelector('.modal');
  const modalClose = document.querySelector('.modal-close');
  const projectCards = document.querySelectorAll('.project-card');

  // Project data (you can expand this)
  const projects = {
    'project-1': {
      title: 'Project One',
      category: 'Web Development',
      description: 'A beautifully designed web application that showcases modern design principles and cutting-edge technology. This project demonstrates expertise in front-end development with a focus on user experience and performance optimization.',
      image: 'https://picsum.photos/900/400?random=1',
      tech: ['HTML', 'CSS', 'JavaScript', 'React'],
      liveUrl: '#',
      codeUrl: '#'
    },
    'project-2': {
      title: 'Project Two',
      category: 'UI/UX Design',
      description: 'An innovative user interface design that prioritizes accessibility and visual appeal. Created with a mobile-first approach and extensive user testing to ensure optimal usability across all devices.',
      image: 'https://picsum.photos/900/400?random=2',
      tech: ['Figma', 'Adobe XD', 'Prototyping'],
      liveUrl: '#',
      codeUrl: '#'
    },
    'project-3': {
      title: 'Project Three',
      category: 'Mobile App',
      description: 'A cross-platform mobile application built with modern frameworks. Features include real-time synchronization, offline capabilities, and seamless integration with cloud services.',
      image: 'https://picsum.photos/900/400?random=3',
      tech: ['React Native', 'Firebase', 'Node.js'],
      liveUrl: '#',
      codeUrl: '#'
    },
    'project-4': {
      title: 'Project Four',
      category: 'Brand Identity',
      description: 'Complete brand identity design including logo, color palette, typography, and brand guidelines. The design reflects the company\'s values of innovation and sustainability.',
      image: 'https://picsum.photos/900/400?random=4',
      tech: ['Illustrator', 'Photoshop', 'InDesign'],
      liveUrl: '#',
      codeUrl: '#'
    },
    'project-5': {
      title: 'Project Five',
      category: 'Web Development',
      description: 'An e-commerce platform built from the ground up with a focus on performance and scalability. Includes custom shopping cart, payment integration, and admin dashboard.',
      image: 'https://picsum.photos/900/400?random=5',
      tech: ['Vue.js', 'Node.js', 'MongoDB', 'Stripe'],
      liveUrl: '#',
      codeUrl: '#'
    },
    'project-6': {
      title: 'Project Six',
      category: 'Interactive',
      description: 'An interactive data visualization project that transforms complex datasets into engaging visual stories. Built with modern web technologies for optimal performance.',
      image: 'https://picsum.photos/900/400?random=6',
      tech: ['D3.js', 'Canvas', 'WebGL'],
      liveUrl: '#',
      codeUrl: '#'
    }
  };

  // Open modal when clicking a project card
  projectCards.forEach(card => {
    card.addEventListener('click', () => {
      const projectId = card.dataset.project;
      const project = projects[projectId];

      if (project && modal) {
        // Populate modal content
        modal.querySelector('.modal-image').src = project.image;
        modal.querySelector('.modal-category').textContent = project.category;
        modal.querySelector('.modal-title').textContent = project.title;
        modal.querySelector('.modal-description').textContent = project.description;

        // Populate tech tags
        const techContainer = modal.querySelector('.modal-tech');
        techContainer.innerHTML = project.tech.map(t => `<span class="tech-tag">${t}</span>`).join('');

        // Update links
        const liveLink = modal.querySelector('.modal-links .btn-primary');
        const codeLink = modal.querySelector('.modal-links .btn-secondary');
        if (liveLink) liveLink.href = project.liveUrl;
        if (codeLink) codeLink.href = project.codeUrl;

        // Show modal
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  // Close modal
  function closeModal() {
    modal?.classList.remove('active');
    document.body.style.overflow = '';
  }

  modalClose?.addEventListener('click', closeModal);

  // Close modal when clicking outside content
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('active')) {
      closeModal();
    }
  });
}

/* ---------- Portfolio Filter ---------- */
function initPortfolioFilter() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.project-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active button
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;

      // Filter projects
      projectCards.forEach(card => {
        const category = card.dataset.category;

        if (filter === 'all' || category === filter) {
          card.style.display = '';
          card.style.animation = 'fadeUp 0.5s ease forwards';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/* ---------- Page Transitions ---------- */
function initPageTransitions() {
  const transition = document.querySelector('.page-transition');
  const links = document.querySelectorAll('a:not([href^="#"]):not([href^="mailto:"]):not([href^="tel:"]):not([target="_blank"])');

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');

      // Only animate for internal links
      if (href && !href.startsWith('http') && !href.startsWith('//')) {
        e.preventDefault();

        transition?.classList.add('active');

        setTimeout(() => {
          window.location.href = href;
        }, 400);
      }
    });
  });

  // Remove transition class on page load
  window.addEventListener('load', () => {
    transition?.classList.remove('active');
  });
}

/* ---------- Scroll Reveal Animation ---------- */
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');

  function checkReveal() {
    const windowHeight = window.innerHeight;
    const revealPoint = 100;

    reveals.forEach(reveal => {
      const revealTop = reveal.getBoundingClientRect().top;

      if (revealTop < windowHeight - revealPoint) {
        reveal.classList.add('active');
      }
    });
  }

  // Check on scroll
  window.addEventListener('scroll', checkReveal);

  // Check on page load
  checkReveal();
}

/* ---------- Utility Functions ---------- */

// Debounce function for performance
function debounce(func, wait = 10) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function for scroll events
function throttle(func, limit = 100) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/* ---------- Contact Form Handler ---------- */
const contactForm = document.querySelector('.contact-form');

if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // Get form data
    const formData = new FormData(contactForm);
    const data = Object.fromEntries(formData);

    // Here you would typically send the data to a server
    // For now, we'll just log it and show a success message
    console.log('Form submitted:', data);

    // Show success message (you can customize this)
    const btn = contactForm.querySelector('.btn');
    const originalText = btn.textContent;

    btn.textContent = 'Message Sent!';
    btn.style.background = 'var(--color-secondary)';

    // Reset form
    contactForm.reset();

    // Reset button after 3 seconds
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
    }, 3000);
  });
}

/* ---------- Typing Effect (Optional) ---------- */
function typeWriter(element, text, speed = 100) {
  let i = 0;
  element.textContent = '';

  function type() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }

  type();
}

// Usage: typeWriter(document.querySelector('.hero-title'), 'Hello, World!', 100);

/* ---------- Cursor Effect (Optional Enhancement) ---------- */
function initCustomCursor() {
  const cursor = document.createElement('div');
  cursor.classList.add('custom-cursor');
  document.body.appendChild(cursor);

  const cursorFollower = document.createElement('div');
  cursorFollower.classList.add('cursor-follower');
  document.body.appendChild(cursorFollower);

  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';

    setTimeout(() => {
      cursorFollower.style.left = e.clientX + 'px';
      cursorFollower.style.top = e.clientY + 'px';
    }, 100);
  });

  // Enlarge cursor on hoverable elements
  const hoverables = document.querySelectorAll('a, button, .project-card');
  hoverables.forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.classList.add('hover');
      cursorFollower.classList.add('hover');
    });
    el.addEventListener('mouseleave', () => {
      cursor.classList.remove('hover');
      cursorFollower.classList.remove('hover');
    });
  });
}

// Uncomment to enable custom cursor:
// initCustomCursor();

console.log('Website loaded successfully! ');
