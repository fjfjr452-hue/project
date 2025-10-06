(function () {
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  const progressBar = document.querySelector('.progress-bar span');
  const progressValue = document.querySelector('.progress-value');

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      mainNav.classList.toggle('open');
    });

    mainNav.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        navToggle.setAttribute('aria-expanded', 'false');
        mainNav.classList.remove('open');
      }
    });
  }

  const animateProgress = () => {
    if (!progressBar || !progressValue) return;
    const target = Number(progressValue.dataset.target || 0);
    let current = 0;
    const increment = Math.max(1, Math.floor(target / 120));

    const counter = () => {
      current += increment;
      if (current >= target) {
        current = target;
        progressValue.textContent = target.toLocaleString();
        progressBar.style.width = '86%';
        clearInterval(intervalId);
      } else {
        progressValue.textContent = current.toLocaleString();
      }
    };

    const intervalId = setInterval(counter, 16);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateProgress();
          observer.disconnect();
        }
      });
    },
    { threshold: 0.4 }
  );

  if (progressBar) {
    observer.observe(progressBar.parentElement);
  }
})();
