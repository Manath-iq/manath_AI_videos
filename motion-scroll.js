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

setupHeroLoop();
setupMagneticButtons();
setupRevealObserver();
setupMotionEngine();
