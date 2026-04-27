const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function setupHeroLoop() {
    const forwardVideo = document.getElementById('heroVideoForward');
    const reverseVideo = document.getElementById('heroVideoReverse');

    if (!forwardVideo || !reverseVideo) return;

    const videos = [forwardVideo, reverseVideo];
    let activeIndex = 0;

    function activateVideo(nextIndex) {
        const currentVideo = videos[activeIndex];
        const nextVideo = videos[nextIndex];

        nextVideo.currentTime = 0;
        nextVideo.play().catch(() => {});
        nextVideo.classList.add('is-active');
        currentVideo.classList.remove('is-active');
        currentVideo.pause();

        activeIndex = nextIndex;
    }

    forwardVideo.addEventListener('ended', () => activateVideo(1));
    reverseVideo.addEventListener('ended', () => activateVideo(0));
}

function setupMagneticButtons() {
    const buttons = document.querySelectorAll('[data-magnetic]');

    buttons.forEach((button) => {
        button.addEventListener('pointermove', (event) => {
            if (window.matchMedia('(pointer: coarse)').matches) return;

            const rect = button.getBoundingClientRect();
            const x = event.clientX - rect.left - rect.width / 2;
            const y = event.clientY - rect.top - rect.height / 2;

            button.style.transform = `translate3d(${x * 0.16}px, ${y * 0.2}px, 0)`;
        });

        button.addEventListener('pointerleave', () => {
            button.style.transform = '';
        });
    });
}

function setupRevealObserver() {
    const revealItems = document.querySelectorAll('[data-reveal]');

    if (!('IntersectionObserver' in window)) {
        revealItems.forEach((item) => item.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, {
        threshold: 0.18,
    });

    revealItems.forEach((item) => observer.observe(item));
}

function getSectionProgress(section) {
    const rect = section.getBoundingClientRect();
    const distance = Math.max(1, section.offsetHeight - window.innerHeight);

    return clamp(-rect.top / distance, 0, 1);
}

function parseRange(step, fallbackStart, fallbackEnd) {
    const rawRange = step.dataset.range;
    if (!rawRange) return [fallbackStart, fallbackEnd];

    const [start, end] = rawRange.split(/\s+/).map(Number);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return [fallbackStart, fallbackEnd];
    }

    return [start, end];
}

function setupMotionSection(section) {
    const stage = section.querySelector('[data-motion-stage]');
    const video = section.querySelector('[data-motion-video]');
    const steps = [...section.querySelectorAll('[data-motion-step]')];

    if (!stage || !video || steps.length === 0) return null;

    const fallbackDuration = Number(section.dataset.motionDuration) || 8;
    const copyStart = Number(section.dataset.motionCopyStart) || 0.08;
    const copyEnd = Number(section.dataset.motionCopyEnd) || 0.24;
    const ranges = steps.map((step, index) => {
        const start = index / steps.length;
        const end = (index + 1) / steps.length;
        return parseRange(step, start, end);
    });

    const state = {
        section,
        stage,
        video,
        steps,
        ranges,
        duration: fallbackDuration,
        targetTime: 0,
        lastAppliedTime: -1,
        isReady: false,
    };

    function updateTarget() {
        const progress = getSectionProgress(section);
        state.targetTime = progress * state.duration;

        const copyProgress = clamp((progress - copyStart) / Math.max(0.001, copyEnd - copyStart), 0, 1);
        const storyProgress = clamp((progress - ranges[0][0]) / Math.max(0.001, ranges[ranges.length - 1][1] - ranges[0][0]), 0, 1);

        stage.style.setProperty('--motion-copy-progress', copyProgress.toFixed(3));
        stage.style.setProperty('--motion-story-progress', storyProgress.toFixed(3));

        let activeIndex = 0;

        ranges.forEach(([start, end], index) => {
            const stepProgress = clamp((progress - start) / (end - start), 0, 1);
            steps[index].style.setProperty('--step-progress', stepProgress.toFixed(3));

            if (progress >= start) {
                activeIndex = index;
            }
        });

        steps.forEach((step, index) => {
            step.classList.toggle('is-active', index === activeIndex);
        });
    }

    video.addEventListener('loadedmetadata', () => {
        state.duration = video.duration || fallbackDuration;
        state.isReady = true;
        video.pause();
        updateTarget();
    });

    updateTarget();

    return {
        state,
        updateTarget,
    };
}

function setupMotionEngine() {
    const sections = [...document.querySelectorAll('[data-motion-section]')]
        .map(setupMotionSection)
        .filter(Boolean);

    if (sections.length === 0) return;

    function frame() {
        sections.forEach((sectionController) => {
            const { state } = sectionController;
            sectionController.updateTarget();

            if (!state.isReady) return;

            const frameStep = 1 / 24;
            const nextTime = clamp(state.targetTime, 0, Math.max(0, state.duration - frameStep));

            if (Math.abs(nextTime - state.lastAppliedTime) >= frameStep * 0.45) {
                state.video.currentTime = nextTime;
                state.lastAppliedTime = nextTime;
            }
        });

        window.requestAnimationFrame(frame);
    }

    window.addEventListener('resize', () => {
        sections.forEach((sectionController) => sectionController.updateTarget());
    });

    window.requestAnimationFrame(frame);
}

function setupStoneEffect() {
    const stoneSection = document.getElementById('stone-effect');
    const canvas = document.getElementById('stoneCanvas');
    if (!stoneSection || !canvas) return;

    const ctx = canvas.getContext('2d');
    const maskCanvas = document.createElement('canvas');
    const maskCtx = maskCanvas.getContext('2d');

    let width = 0;
    let height = 0;
    let dpr = 1;
    
    let mouse = { x: -1000, y: -1000 };
    let current = { x: -1000, y: -1000 };
    let isHovering = false;

    // Load image reliably via JS
    const nakedImg = new Image();
    nakedImg.src = 'stone_naked.png';

    function resize() {
        width = stoneSection.clientWidth;
        height = stoneSection.clientHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 for performance
        
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        maskCanvas.width = width * dpr;
        maskCanvas.height = height * dpr;
        
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    window.addEventListener('resize', resize);
    resize();

    stoneSection.addEventListener('mousemove', (e) => {
        const rect = stoneSection.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        isHovering = true;
        
        // Parallax effect
        const cx = width / 2;
        const cy = height / 2;
        const moveX = (mouse.x - cx) * -0.02;
        const moveY = (mouse.y - cy) * -0.02;
        const layout = stoneSection.querySelector('.stone-layout');
        if(layout) layout.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
    });

    stoneSection.addEventListener('mouseleave', () => {
        isHovering = false;
        const layout = stoneSection.querySelector('.stone-layout');
        if(layout) layout.style.transform = `translate3d(0, 0, 0)`;
    });

    if (nakedImg.complete) {
        startAnimation();
    } else {
        nakedImg.addEventListener('load', startAnimation);
    }

    function startAnimation() {
        requestAnimationFrame(render);
    }

    function render() {
        // Spring easing for smooth brush following
        current.x += (mouse.x - current.x) * 0.15;
        current.y += (mouse.y - current.y) * 0.15;

        // Fade the mask to create a trail
        maskCtx.globalCompositeOperation = 'destination-out';
        maskCtx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        maskCtx.fillRect(0, 0, width, height);

        // Draw new mask circle
        if (isHovering) {
            maskCtx.globalCompositeOperation = 'source-over';
            const radius = 220; // Radius of brush
            const gradient = maskCtx.createRadialGradient(current.x, current.y, 0, current.x, current.y, radius);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.8)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            maskCtx.fillStyle = gradient;
            maskCtx.beginPath();
            maskCtx.arc(current.x, current.y, radius, 0, Math.PI * 2);
            maskCtx.fill();
        }

        ctx.clearRect(0, 0, width, height);

        if (!nakedImg.naturalWidth) {
            requestAnimationFrame(render);
            return;
        }

        // Calculate aspect ratio for object-fit: cover
        const imgRatio = nakedImg.naturalWidth / nakedImg.naturalHeight;
        const canvasRatio = width / height;
        let drawWidth, drawHeight, offsetX, offsetY;

        if (canvasRatio > imgRatio) {
            drawWidth = width;
            drawHeight = width / imgRatio;
            offsetX = 0;
            offsetY = (height - drawHeight) / 2;
        } else {
            drawWidth = height * imgRatio;
            drawHeight = height;
            offsetX = (width - drawWidth) / 2;
            offsetY = 0;
        }

        // Draw the base image
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(nakedImg, offsetX, offsetY, drawWidth, drawHeight);

        // Apply mask (Note: we draw maskCanvas without scaling because it's already scaled intrinsically, but wait - ctx.drawImage with a canvas source ignores the destination's current transform if we just pass 0,0? No, drawImage maps the source canvas (width*dpr x height*dpr) into the destination. Since we setTransform on ctx, drawing maskCanvas at (0,0) with size (width, height) is correct.)
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0, width, height);

        requestAnimationFrame(render);
    }
}

function setupSplitText() {
    const splitElements = document.querySelectorAll('[data-split]');
    
    splitElements.forEach(el => {
        const text = el.innerText;
        const words = text.split(' ').filter(w => w.trim().length > 0);
        el.innerHTML = '';
        
        words.forEach((word, wordIndex) => {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'word';
            wordSpan.innerText = word;
            
            const delay = wordIndex * 0.04;
            wordSpan.style.transitionDelay = `${delay}s`;
            
            el.appendChild(wordSpan);
            
            if (wordIndex < words.length - 1) {
                const space = document.createElement('span');
                space.className = 'space';
                space.innerHTML = '&nbsp;';
                el.appendChild(space);
            }
        });
    });

    const revealContainer = document.querySelector('[data-split-reveal]');
    if (revealContainer && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.3 });
        observer.observe(revealContainer);
    } else if (revealContainer) {
        revealContainer.classList.add('is-visible');
    }
}

setupHeroLoop();
setupMagneticButtons();
setupRevealObserver();
setupMotionEngine();
setupStoneEffect();
setupSplitText();
