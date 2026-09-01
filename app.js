/**
 * Application Logic for Dr. Bharath's Acu Heal Quotation
 * Prepared by BUILD FAST WEB
 * Adheres to the strict visual system, single motion budget, and PDF generation.
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMotionObserver();
  initModuleFilters();
  initStorageCalculator();
  initPdfAndPrintActions();
});

/* ==========================================================================
   THEME TOGGLE SYSTEM (Light & Dark adhering to Paper / Ink / Steel tokens)
   ========================================================================== */
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  const themeLabel = document.getElementById('themeLabel');
  const themeIconSun = document.getElementById('themeIconSun');
  const htmlRoot = document.documentElement;

  // Retrieve saved preference or default to light
  const savedTheme = localStorage.getItem('bac_theme') || 'light';
  applyTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = htmlRoot.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
      localStorage.setItem('bac_theme', newTheme);
    });
  }

  function applyTheme(theme) {
    htmlRoot.setAttribute('data-theme', theme);
    if (themeLabel) {
      themeLabel.textContent = theme === 'light' ? 'Dark Mode' : 'Light Mode';
    }
    if (themeIconSun) {
      if (theme === 'dark') {
        // Moon icon representation
        themeIconSun.innerHTML = `
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        `;
      } else {
        // Sun icon representation
        themeIconSun.innerHTML = `
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        `;
      }
    }
  }
}

/* ==========================================================================
   MOTION BUDGET: Single fade and rise on scroll
   ========================================================================== */
function initMotionObserver() {
  const elements = document.querySelectorAll('.fade-rise');
  if (!('IntersectionObserver' in window)) {
    elements.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

/* ==========================================================================
   INTERACTIVE MODULE CATEGORY FILTER
   ========================================================================== */
function initModuleFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const moduleCards = document.querySelectorAll('.module-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');

      moduleCards.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filter === 'all' || category === filter) {
          card.style.display = 'flex';
          setTimeout(() => card.classList.add('is-visible'), 10);
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/* ==========================================================================
   INTERACTIVE STORAGE & COST ESTIMATOR
   1-min video up to 20 MB, Patient photo ~2 MB
   Base: 10 GB Included (₹0 extra). Extra: ₹50 / GB / month on actual exceeded storage.
   ========================================================================== */
function initStorageCalculator() {
  const videoSlider = document.getElementById('videoSlider');
  const imageSlider = document.getElementById('imageSlider');

  const videoDisplay = document.getElementById('videoDisplay');
  const imageDisplay = document.getElementById('imageDisplay');

  const metricVideosGb = document.getElementById('metricVideosGb');
  const metricVideosCount = document.getElementById('metricVideosCount');
  const metricImagesGb = document.getElementById('metricImagesGb');
  const metricImagesCount = document.getElementById('metricImagesCount');

  const meterUsedText = document.getElementById('meterUsedText');
  const meterStatusBadge = document.getElementById('meterStatusBadge');
  const meterFill = document.getElementById('meterFill');

  const calcTotalGb = document.getElementById('calcTotalGb');
  const extraGbText = document.getElementById('extraGbText');
  const extraCostText = document.getElementById('extraCostText');
  const totalMonthlyPrice = document.getElementById('totalMonthlyPrice');

  if (!videoSlider || !imageSlider) return;

  function recalculate() {
    const videoCount = parseInt(videoSlider.value, 10) || 0;
    const imageCount = parseInt(imageSlider.value, 10) || 0;

    // Sizes in MB: 1-min video = 20 MB, Photo = 2 MB
    const videoSizeMb = 20;
    const imageSizeMb = 2;

    const totalVideoMb = videoCount * videoSizeMb;
    const totalImageMb = imageCount * imageSizeMb;

    const totalVideoGb = totalVideoMb / 1024;
    const totalImageGb = totalImageMb / 1024;
    const totalGb = totalVideoGb + totalImageGb;

    const includedGb = 10;
    const ratePerExtraGb = 50;
    const baseMonthlyFee = 3000;

    // Format display badges
    if (videoDisplay) videoDisplay.textContent = `${videoCount.toLocaleString('en-IN')} Videos`;
    if (imageDisplay) imageDisplay.textContent = `${imageCount.toLocaleString('en-IN')} Photos`;

    if (metricVideosGb) metricVideosGb.textContent = `${totalVideoGb.toFixed(1)} GB`;
    if (metricVideosCount) metricVideosCount.textContent = `${videoCount} Videos (@ 20MB)`;

    if (metricImagesGb) metricImagesGb.textContent = `${totalImageGb.toFixed(1)} GB`;
    if (metricImagesCount) metricImagesCount.textContent = `${imageCount.toLocaleString('en-IN')} Photos (@ 2MB)`;

    if (meterUsedText) meterUsedText.textContent = `${totalGb.toFixed(1)} GB`;
    if (calcTotalGb) calcTotalGb.textContent = `${totalGb.toFixed(1)} GB`;

    // Progress bar calculation (10 GB = 100% of base allowance)
    const percentageOfBase = Math.min(100, Math.round((totalGb / includedGb) * 100));
    if (meterFill) {
      meterFill.style.width = `${percentageOfBase}%`;
      if (totalGb > includedGb) {
        meterFill.classList.add('exceeded');
      } else {
        meterFill.classList.remove('exceeded');
      }
    }

    if (totalGb <= includedGb) {
      const pct = Math.round((totalGb / includedGb) * 100);
      if (meterStatusBadge) meterStatusBadge.textContent = `${pct}% of Free 10 GB Allowance`;
      if (extraGbText) extraGbText.textContent = `0 GB (Within free plan)`;
      if (extraCostText) extraCostText.textContent = `₹0 / mo`;
      if (totalMonthlyPrice) totalMonthlyPrice.textContent = `₹${baseMonthlyFee.toLocaleString('en-IN')}`;
    } else {
      const extraGb = (totalGb - includedGb).toFixed(1);
      const billableUnits = Math.ceil(totalGb - includedGb);
      const extraCost = billableUnits * ratePerExtraGb;
      const totalMonthly = baseMonthlyFee + extraCost;

      if (meterStatusBadge) meterStatusBadge.textContent = `Exceeds by +${extraGb} GB`;
      if (extraGbText) extraGbText.textContent = `+${extraGb} GB (Exceeded)`;
      if (extraCostText) extraCostText.textContent = `+ ₹${extraCost.toLocaleString('en-IN')} / mo`;
      if (totalMonthlyPrice) totalMonthlyPrice.textContent = `₹${totalMonthly.toLocaleString('en-IN')}`;
    }
  }

  videoSlider.addEventListener('input', recalculate);
  imageSlider.addEventListener('input', recalculate);
  recalculate();
}

/* ==========================================================================
   PDF EXPORT & PRINT HANDLERS
   Generates a pristine A4 formal quotation document
   ========================================================================== */
function initPdfAndPrintActions() {
  const printBtn = document.getElementById('printBtn');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const heroPdfBtn = document.getElementById('heroPdfBtn');

  // Direct Browser Print (Optimized by @media print)
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // 1-Click PDF Generation via html2pdf with fallback
  const triggerPdfDownload = () => {
    const element = document.getElementById('quotationContent');
    const originalTheme = document.documentElement.getAttribute('data-theme');

    // Force light theme temporarily for pristine white PDF rendering
    document.documentElement.setAttribute('data-theme', 'light');

    // Make sure all modules are visible for PDF export
    const moduleCards = document.querySelectorAll('.module-card');
    moduleCards.forEach(card => (card.style.display = 'flex'));
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(b => b.classList.remove('active'));
    const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
    if (allBtn) allBtn.classList.add('active');

    // Configure html2pdf options
    const opt = {
      margin: [10, 10, 10, 10],
      filename: 'BUILD_FAST_WEB_Quotation_Dr_Bharath_Acu_Heal.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // Show download state on buttons
    const activeBtn = downloadPdfBtn || heroPdfBtn;
    const originalText = activeBtn ? activeBtn.innerHTML : '';
    if (activeBtn) {
      activeBtn.innerHTML = `
        <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
        </svg>
        <span>Generating PDF...</span>
      `;
    }

    if (window.html2pdf) {
      html2pdf().set(opt).from(element).save().then(() => {
        // Restore theme and button
        document.documentElement.setAttribute('data-theme', originalTheme || 'light');
        if (activeBtn) activeBtn.innerHTML = originalText;
      }).catch(err => {
        console.error('PDF export fallback triggered:', err);
        document.documentElement.setAttribute('data-theme', originalTheme || 'light');
        if (activeBtn) activeBtn.innerHTML = originalText;
        window.print();
      });
    } else {
      document.documentElement.setAttribute('data-theme', originalTheme || 'light');
      if (activeBtn) activeBtn.innerHTML = originalText;
      window.print();
    }
  };

  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', triggerPdfDownload);
  }
  if (heroPdfBtn) {
    heroPdfBtn.addEventListener('click', triggerPdfDownload);
  }
}
