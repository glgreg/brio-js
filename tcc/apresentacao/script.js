document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    const slides = document.querySelectorAll('.slide');
    const totalSlides = slides.length;
    let currentSlideIndex = 0; // 0-indexed

    const progressBar = document.getElementById('progressBar');
    const currentSlideNum = document.getElementById('currentSlideNum');
    const totalSlidesNum = document.getElementById('totalSlidesNum');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    // Set total slide count in UI
    totalSlidesNum.textContent = totalSlides;

    function updatePresentation() {
        // Remove active class from all slides
        slides.forEach((slide, idx) => {
            if (idx === currentSlideIndex) {
                slide.classList.add('active');
            } else {
                slide.classList.remove('active');
            }
        });

        // Update progress bar
        const progressPercentage = ((currentSlideIndex + 1) / totalSlides) * 100;
        progressBar.style.width = `${progressPercentage}%`;

        // Update slide counter
        currentSlideNum.textContent = currentSlideIndex + 1;

        // Enable/Disable buttons
        prevBtn.disabled = currentSlideIndex === 0;
        nextBtn.disabled = currentSlideIndex === totalSlides - 1;

        // Visual opacity for disabled buttons
        prevBtn.style.opacity = currentSlideIndex === 0 ? '0.3' : '1';
        prevBtn.style.pointerEvents = currentSlideIndex === 0 ? 'none' : 'auto';
        nextBtn.style.opacity = currentSlideIndex === totalSlides - 1 ? '0.3' : '1';
        nextBtn.style.pointerEvents = currentSlideIndex === totalSlides - 1 ? 'none' : 'auto';
    }

    function nextSlide() {
        if (currentSlideIndex < totalSlides - 1) {
            currentSlideIndex++;
            updatePresentation();
        }
    }

    function prevSlide() {
        if (currentSlideIndex > 0) {
            currentSlideIndex--;
            updatePresentation();
        }
    }

    // Event Listeners for buttons
    prevBtn.addEventListener('click', prevSlide);
    nextBtn.addEventListener('click', nextSlide);

    // Keyboard Navigation
    document.addEventListener('keydown', (e) => {
        // Check for navigation keys
        if (e.key === 'ArrowRight' || e.key === ' ') {
            e.preventDefault();
            nextSlide();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prevSlide();
        }
        
        // Fullscreen Toggle: Shift + F
        if (e.shiftKey && (e.key === 'F' || e.key === 'f')) {
            e.preventDefault();
            const container = document.querySelector('.presentation-container');
            if (!document.fullscreenElement) {
                container.requestFullscreen().catch(err => {
                    console.warn(`Fullscreen request failed: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        }
    });

    // Touch support (swipe left/right)
    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, false);

    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, false);

    function handleSwipe() {
        const threshold = 50;
        if (touchStartX - touchEndX > threshold) {
            // Swiped left, show next slide
            nextSlide();
        } else if (touchEndX - touchStartX > threshold) {
            // Swiped right, show prev slide
            prevSlide();
        }
    }



    // Initial load updates
    updatePresentation();
});
