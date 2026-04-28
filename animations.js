/**
 * ASRS Scroll Narrative Animations
 * GSAP + ScrollTrigger
 *
 * Architecture: Each section's animation is encapsulated in its own function.
 * Modify CSS selectors to match your actual DOM structure.
 */

(function() {
    'use strict';

    // ==========================================
    // Configuration & Environment Detection
    // ==========================================

    const isMobile = window.innerWidth < 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const PARAMS = {
        heroWordStagger: 0.05,
        heroWordDuration: 0.8,
        heroSubDelay: 0.3,
        heroSubDuration: 0.6,

        cardDistanceY: isMobile ? 30 : 60,
        cardScaleFrom: 0.95,
        cardStagger: isMobile ? 0.08 : 0.15,
        cardDuration: isMobile ? 0.5 : 0.7,

        faqTitleDistanceX: isMobile ? 15 : 30,
        faqItemDistanceX: isMobile ? 15 : 30,
        faqItemStagger: isMobile ? 0.06 : 0.1,
        faqItemDuration: 0.5,

        serviceStagger: isMobile ? 0.06 : 0.12,
        serviceDuration: 0.6,

        caseImageDuration: 1,
        caseTextDelay: 0.5,
        caseCardStagger: 0.3,

        ctaDistanceY: isMobile ? 20 : 40,
        ctaDuration: 0.8,
        ctaButtonDelay: 0.2,
    };

    // ==========================================
    // Reduced Motion Support
    // ==========================================

    if (prefersReducedMotion) {
        return;
    }

    // ==========================================
    // Utility: Split text into word spans
    // ==========================================

    function splitIntoWords(element) {
        if (!element) return [];
        const text = element.textContent.trim();
        if (!text) return [];
        const words = text.split(/\s+/);
        element.innerHTML = words.map(function(word) {
            return '<span class="hero-word" style="display:inline-block; margin-right:0.3em;">' + word + '</span>';
        }).join(' ');
        return element.querySelectorAll('.hero-word');
    }

    // ==========================================
    // Section 1: Hero Animation (auto-play on load)
    // ==========================================

    function initHeroAnimation() {
        const h1 = document.querySelector('.hero h1');
        if (!h1) return;

        const wordSpans = splitIntoWords(h1);
        if (wordSpans.length === 0) return;

        const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

        tl.from(wordSpans, {
            y: isMobile ? 15 : 30,
            opacity: 0,
            duration: PARAMS.heroWordDuration,
            stagger: PARAMS.heroWordStagger,
        });

        tl.from('.hero p, .hero-buttons', {
            y: isMobile ? 10 : 20,
            opacity: 0,
            duration: PARAMS.heroSubDuration,
        }, '+=' + PARAMS.heroSubDelay);

        const hero = document.querySelector('.hero');
        if (hero) {
            let grid = hero.querySelector('.hero-grid');
            if (!grid) {
                grid = document.createElement('div');
                grid.className = 'hero-grid';
                hero.insertBefore(grid, hero.firstChild);
            }
            tl.to(grid, {
                opacity: 0.03,
                duration: 1.5,
            }, 0);
        }
    }

    // ==========================================
    // Section 2: Project Scale Cards
    // ==========================================

    function initScalesAnimation() {
        const cards = document.querySelectorAll('.scale-card');
        if (cards.length === 0) return;

        gsap.from(cards, {
            y: PARAMS.cardDistanceY,
            opacity: 0,
            scale: PARAMS.cardScaleFrom,
            duration: PARAMS.cardDuration,
            stagger: PARAMS.cardStagger,
            ease: 'power2.out',
            scrollTrigger: {
                trigger: '.scale-grid',
                start: 'top 80%',
                once: true,
            },
        });
    }

    // ==========================================
    // Section 3: FAQ / Planning Section
    // ==========================================

    function initFaqAnimation() {
        const section = document.querySelector('.faq-section');
        if (!section) return;

        const title = section.querySelector('h2');
        if (title) {
            gsap.from(title, {
                x: -PARAMS.faqTitleDistanceX,
                opacity: 0,
                duration: 0.6,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: section,
                    start: 'top 80%',
                    once: true,
                },
            });
        }

        const items = section.querySelectorAll('.faq-list li');
        items.forEach(function(item, index) {
            let line = item.querySelector('.faq-line-indicator');
            if (!line) {
                line = document.createElement('span');
                line.className = 'faq-line-indicator';
                item.appendChild(line);
            }

            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: item,
                    start: 'top 85%',
                    once: true,
                },
            });

            tl.from(item, {
                x: PARAMS.faqItemDistanceX,
                opacity: 0,
                duration: PARAMS.faqItemDuration,
                ease: 'power2.out',
                delay: index * PARAMS.faqItemStagger,
            });

            tl.from(line, {
                scaleY: 0,
                transformOrigin: 'top',
                duration: 0.4,
                ease: 'power2.out',
            }, '-=0.3');
        });
    }

    // ==========================================
    // Section 4: Services (What We Do)
    // ==========================================

    function initServicesAnimation() {
        const section = document.querySelector('.what-we-do');
        if (!section) return;

        const title = section.querySelector('h2');
        if (title) {
            gsap.from(title, {
                x: -PARAMS.faqTitleDistanceX,
                opacity: 0,
                duration: 0.6,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: section,
                    start: 'top 80%',
                    once: true,
                },
            });
        }

        const boxes = section.querySelectorAll('.service-box');
        boxes.forEach(function(box) {
            const icon = box.querySelector('.service-icon');
            const texts = box.querySelectorAll('h3, p');

            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: box,
                    start: 'top 85%',
                    once: true,
                },
            });

            if (icon) {
                if (isMobile) {
                    tl.from(icon, {
                        scale: 0.8,
                        opacity: 0,
                        duration: PARAMS.serviceDuration,
                        ease: 'power2.out',
                    });
                } else {
                    tl.from(icon, {
                        scale: 0.8,
                        opacity: 0,
                        duration: PARAMS.serviceDuration,
                        ease: 'back.out(1.2)',
                    });
                }
            }

            tl.from(texts, {
                y: isMobile ? 10 : 20,
                opacity: 0,
                duration: PARAMS.serviceDuration,
                ease: 'power2.out',
            }, isMobile ? '-=0.3' : '-=0.4');
        });
    }

    // ==========================================
    // Section 5: Case Studies
    // ==========================================

    function initCasesAnimation() {
        const cards = document.querySelectorAll('.case-card');
        if (cards.length === 0) return;

        cards.forEach(function(card) {
            const image = card.querySelector('.case-image');
            const contents = card.querySelectorAll('.case-content h3, .case-content p, .case-content .btn-case, .case-content a');

            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: card,
                    start: 'top 80%',
                    once: true,
                },
            });

            if (image) {
                if (isMobile) {
                    tl.from(image, {
                        opacity: 0,
                        y: 20,
                        duration: PARAMS.caseImageDuration,
                        ease: 'power2.out',
                    });
                } else {
                    tl.from(image, {
                        filter: 'blur(8px) brightness(0.7)',
                        scale: 1.05,
                        duration: PARAMS.caseImageDuration,
                        ease: 'power2.out',
                    });
                }
            }

            if (contents.length > 0) {
                tl.from(contents, {
                    y: isMobile ? 20 : 40,
                    opacity: 0,
                    duration: 0.6,
                    stagger: 0.1,
                    ease: 'power2.out',
                }, PARAMS.caseTextDelay);
            }
        });
    }

    // ==========================================
    // Section 6: CTA Section
    // ==========================================

    function initCtaAnimation() {
        const section = document.querySelector('.cta-section');
        if (!section) return;

        const box = section.querySelector('.cta-box');
        if (!box) return;

        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: section,
                start: 'top 80%',
                once: true,
            },
        });

        tl.from(box, {
            y: PARAMS.ctaDistanceY,
            opacity: 0,
            duration: PARAMS.ctaDuration,
            ease: 'power2.out',
        });

        const btn = box.querySelector('.btn-large, .btn');
        if (btn) {
            tl.from(btn, {
                scale: 0.9,
                opacity: 0,
                duration: 0.6,
                ease: 'back.out(1.5)',
            }, '+=' + PARAMS.ctaButtonDelay);
        }
    }

    // ==========================================
    // Section 7: Navbar Scroll Effect
    // ==========================================

    function initNavbarScroll() {
        const header = document.querySelector('header');
        if (!header) return;

        window.addEventListener('scroll', function() {
            if (window.scrollY > 100) {
                header.classList.add('header-scrolled');
            } else {
                header.classList.remove('header-scrolled');
            }
        }, { passive: true });
    }

    // ==========================================
    // Master Initialization
    // ==========================================

    function initAllAnimations() {
        if (prefersReducedMotion) return;
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
            console.warn('GSAP or ScrollTrigger not loaded. Animations skipped.');
            return;
        }

        gsap.registerPlugin(ScrollTrigger);

        initHeroAnimation();
        initScalesAnimation();
        initFaqAnimation();
        initServicesAnimation();
        initCasesAnimation();
        initCtaAnimation();
        initNavbarScroll();
    }

    // ==========================================
    // Boot: Wait for i18n then initialize
    // ==========================================

    function boot() {
        if (!document.documentElement.classList.contains('i18n-pending')) {
            initAllAnimations();
            return;
        }

        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (!document.documentElement.classList.contains('i18n-pending')) {
                        observer.disconnect();
                        initAllAnimations();
                    }
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.addEventListener('load', function() {
        if (typeof gsap !== 'undefined' && !window.__asrsAnimationsInitialized) {
            window.__asrsAnimationsInitialized = true;
            initAllAnimations();
        }
    });
})();
