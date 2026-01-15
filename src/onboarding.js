class Onboarding {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 3;
    this.overlay = document.getElementById('onboarding-overlay');
    this.prevButton = document.querySelector('.onboarding-prev');
    this.nextButton = document.querySelector('.onboarding-next');
    this.dots = document.querySelectorAll('.onboarding-dot');

    this.init();
  }

  init() {
    // Check if first visit
    if (!localStorage.getItem('onboardingCompleted')) {
      this.show();
      this.bindEvents();
    }
  }

  bindEvents() {
    this.prevButton.addEventListener('click', () => this.navigate('prev'));
    this.nextButton.addEventListener('click', () => this.navigate('next'));

    // Allow clicking dots to jump to step
    document.querySelectorAll('.dot').forEach((dot, index) => {
      dot.addEventListener('click', () => this.goToStep(index + 1));
    });
  }

  show() {
    this.overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  hide() {
    this.overlay.classList.add('hidden');
    document.body.style.overflow = '';
    localStorage.setItem('onboardingCompleted', 'true');
  }

  navigate(direction) {
    if (direction === 'next') {
      if (this.currentStep === this.totalSteps) {
        this.hide();
        return;
      }
      this.goToStep(this.currentStep + 1);
    } else {
      this.goToStep(this.currentStep - 1);
    }
  }

  goToStep(step) {
    // Update step state
    document.querySelectorAll('.onboarding-step').forEach(stepEl => {
      stepEl.classList.remove('active');
      if (parseInt(stepEl.dataset.step) === step) {
        stepEl.classList.add('active');
      }
    });

    // Update dot state
    document.querySelectorAll('.dot').forEach((dot, index) => {
      dot.classList.toggle('active', index + 1 === step);
    });

    // Update button state
    this.prevButton.disabled = step === 1;
    if (step === this.totalSteps) {
      this.nextButton.textContent = window.getLocalizedMessage('finishButton');
    } else {
      this.nextButton.textContent = window.getLocalizedMessage('nextButton');
    }

    this.currentStep = step;
  }
}

// Initialize onboarding when DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  new Onboarding();
}); 