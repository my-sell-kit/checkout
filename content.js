(function() {
  'use strict';
  
  // ========== DEBUG MODE ==========
  var DEBUG = new URLSearchParams(window.location.search).get('msk_debug') === '1';
  var log = {
    info: function() { if (DEBUG) console.log.apply(console, ['🔵 [MSK Content]'].concat(Array.prototype.slice.call(arguments))); },
    success: function() { if (DEBUG) console.log.apply(console, ['✅ [MSK Content]'].concat(Array.prototype.slice.call(arguments))); },
    warn: function() { if (DEBUG) console.warn.apply(console, ['⚠️ [MSK Content]'].concat(Array.prototype.slice.call(arguments))); },
    error: function() { if (DEBUG) console.error.apply(console, ['❌ [MSK Content]'].concat(Array.prototype.slice.call(arguments))); }
  };
  
  // ========== TRANSLATIONS ==========
  var TRANSLATIONS = {
    en: { whatsIncluded: "What's included", reviews: "reviews", mostRecent: "Most recent", highestRated: "Highest rated", lowestRated: "Lowest rated", verified: "Verified" },
    fr: { whatsIncluded: "Ce qui est inclus", reviews: "avis", mostRecent: "Plus récents", highestRated: "Meilleures notes", lowestRated: "Moins bonnes notes", verified: "Vérifié" },
    es: { whatsIncluded: "Qué incluye", reviews: "reseñas", mostRecent: "Más recientes", highestRated: "Mejor valorados", lowestRated: "Peor valorados", verified: "Verificado" },
    de: { whatsIncluded: "Was enthalten ist", reviews: "Bewertungen", mostRecent: "Neueste", highestRated: "Beste Bewertung", lowestRated: "Schlechteste Bewertung", verified: "Verifiziert" },
    it: { whatsIncluded: "Cosa è incluso", reviews: "recensioni", mostRecent: "Più recenti", highestRated: "Voto più alto", lowestRated: "Voto più basso", verified: "Verificato" },
    pt: { whatsIncluded: "O que está incluído", reviews: "avaliações", mostRecent: "Mais recentes", highestRated: "Melhor avaliados", lowestRated: "Pior avaliados", verified: "Verificado" },
    nl: { whatsIncluded: "Wat is inbegrepen", reviews: "beoordelingen", mostRecent: "Meest recent", highestRated: "Hoogst beoordeeld", lowestRated: "Laagst beoordeeld", verified: "Geverifieerd" },
    ja: { whatsIncluded: "含まれるもの", reviews: "レビュー", mostRecent: "最新", highestRated: "高評価順", lowestRated: "低評価順", verified: "認証済み" }
  };
  
  function detectLanguage() {
    var lang = (navigator.language || navigator.userLanguage || 'en').split('-')[0].toLowerCase();
    return TRANSLATIONS[lang] ? lang : 'en';
  }
  
  var currentLang = detectLanguage();
  var t = TRANSLATIONS[currentLang];
  
  // ========== HELPER FUNCTIONS ==========
  
  /**
   * Smart HTML decoder - handles both base64 (Webflow) and direct HTML (Bubble)
   */
  function smartDecodeHtml(content) {
    if (!content) return '';
    
    var trimmed = content.trim();
    
    // If it looks like HTML, use it directly
    if (trimmed.indexOf('<') === 0 || trimmed.indexOf('<') > -1) {
      log.info('Detected direct HTML content');
      return trimmed;
    }
    
    // Otherwise, try base64 decoding
    try {
      log.info('Attempting base64 decode');
      var binaryString = atob(trimmed);
      var bytes = new Uint8Array(binaryString.length);
      for (var i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
      log.warn('Base64 decode failed, trying simple atob');
      try { 
        return atob(trimmed); 
      } catch (e2) { 
        log.warn('All decoding failed, returning original');
        return trimmed;
      }
    }
  }
  
  function isValidValue(value) {
    if (!value) return false;
    var trimmed = value.trim();
    if (trimmed === '') return false;
    if (trimmed.indexOf('{{') === 0 && trimmed.indexOf('}}') === trimmed.length - 2) return false;
    return true;
  }
  
  function getInitials(name) {
    if (!name) return '?';
    var parts = name.trim().split(' ');
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
  }
  
  function formatRelativeDate(dateStr) {
    if (!dateStr) return '';
    try {
      var diffDays = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return diffDays + " days ago";
      if (diffDays < 30) return Math.floor(diffDays / 7) + " weeks ago";
      if (diffDays < 365) return Math.floor(diffDays / 30) + " months ago";
      return Math.floor(diffDays / 365) + " years ago";
    } catch (e) { return dateStr; }
  }
  
  function generateStars(rating) {
    var filled = '<svg class="msk-review-star msk-review-star-filled" viewBox="0 0 12 12" fill="currentColor"><path d="M6 0l1.76 3.77 3.99.54-2.92 2.77.72 3.92L6 9.13 2.45 11l.72-3.92L.25 4.31l3.99-.54z"/></svg>';
    var empty = '<svg class="msk-review-star msk-review-star-empty" viewBox="0 0 12 12" fill="currentColor"><path d="M6 0l1.76 3.77 3.99.54-2.92 2.77.72 3.92L6 9.13 2.45 11l.72-3.92L.25 4.31l3.99-.54z"/></svg>';
    var stars = '';
    var r = parseInt(rating) || 0;
    for (var i = 1; i <= 5; i++) stars += i <= r ? filled : empty;
    return stars;
  }
  
  // ========== MAIN RENDER FUNCTION ==========
  window.MSKContent = {
    render: function(config) {
      log.info('Rendering content with config:', config);
      
      var wrapper = document.getElementById(config.wrapperId || 'mysellkit-content-wrapper');
      if (!wrapper) {
        log.error('Wrapper not found:', config.wrapperId || 'mysellkit-content-wrapper');
        return false;
      }
      
      // Set language if provided
      if (config.language && TRANSLATIONS[config.language]) {
        currentLang = config.language;
        t = TRANSLATIONS[currentLang];
      }
      
      // Build structure
      wrapper.innerHTML = '<div class="mysellkit-page-container"><div class="mysellkit-content" id="mysellkit-content"></div><div class="msk-whats-included-section" id="msk-whats-included"></div><div class="msk-reviews-section" id="msk-reviews"></div></div>';
      
      var contentEl = document.getElementById('mysellkit-content');
      var whatsIncludedEl = document.getElementById('msk-whats-included');
      var reviewsEl = document.getElementById('msk-reviews');
      
      // HTML Content - NOW HANDLES BOTH BASE64 AND DIRECT HTML
      if (contentEl && isValidValue(config.htmlContent)) {
        log.info('Processing HTML content');
        contentEl.innerHTML = smartDecodeHtml(config.htmlContent);
      }
      
      // What's Included
      if (whatsIncludedEl && isValidValue(config.filesList)) {
        var files = config.filesList.split('|||').filter(function(f) { return f.trim(); });
        if (files.length > 0) {
          log.info('Building What\'s Included with', files.length, 'files');
          var title = isValidValue(config.whatsIncludedTitle) ? config.whatsIncludedTitle : t.whatsIncluded;
          var filesHtml = files.map(function(file) {
            var fileName = file.trim();
            var lastDot = fileName.lastIndexOf('.');
            var name = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
            var ext = lastDot > 0 ? fileName.substring(lastDot + 1).toUpperCase() : '';
            return '<div class="msk-file-block"><div class="msk-file-icon-wrapper"><svg class="msk-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div class="msk-file-info"><span class="msk-file-name">' + name + '</span>' + (ext ? '<span class="msk-file-ext">' + ext + '</span>' : '') + '</div></div>';
          }).join('');
          whatsIncludedEl.innerHTML = '<h2 class="mysellkit-section-title">' + title + '</h2><div class="msk-files-grid">' + filesHtml + '</div>';
        }
      }
      
      // Reviews
      if (reviewsEl && isValidValue(config.reviewsList)) {
        var reviews = config.reviewsList.split('|||').filter(function(r) { return r.trim(); }).map(function(reviewStr) {
          var parts = reviewStr.split('::');
          return { name: (parts[0] || '').trim(), date: (parts[1] || '').trim(), rating: parseInt(parts[2]) || 5, message: (parts[3] || '').trim(), verified: (parts[4] || '').trim().toLowerCase() === 'yes' };
        }).filter(function(r) { return r.name && r.name !== 'null' && r.name !== 'undefined'; });

        if (reviews.length > 0) {
          log.info('Building Reviews with', reviews.length, 'reviews');
          var reviewsTitle = isValidValue(config.reviewsTitle) ? config.reviewsTitle : t.reviews;
          var verifiedLabel = isValidValue(config.reviewsVerifiedLabel) ? config.reviewsVerifiedLabel : t.verified;

          // Store original reviews for sorting
          var originalReviews = reviews.slice();

          function buildReviewHtml(review, index) {
            var initials = getInitials(review.name);
            var relativeDate = formatRelativeDate(review.date);
            var starsHtml = generateStars(review.rating);
            var verifiedBadge = review.verified ? '<span class="msk-review-verified"><svg class="msk-review-verified-icon" viewBox="0 0 12 12" fill="currentColor"><path d="M6 0C2.69 0 0 2.69 0 6s2.69 6 6 6 6-2.69 6-6S9.31 0 6 0zm-.75 9L2.5 6.25l1.06-1.06 1.69 1.69 3.69-3.69L10 4.25 5.25 9z"/></svg>' + verifiedLabel + '</span>' : '';
            var messageHtml = review.message ? '<p class="msk-review-message">' + review.message + '</p>' : '';
            return '<div class="msk-review-item" data-review-index="' + index + '" data-rating="' + review.rating + '" data-date="' + review.date + '"><div class="msk-review-header"><div class="msk-review-avatar">' + initials + '</div><div class="msk-review-author-info"><div class="msk-review-author-row"><span class="msk-review-author">' + review.name + '</span>' + verifiedBadge + '</div><div class="msk-review-meta"><div class="msk-review-stars">' + starsHtml + '</div>' + (relativeDate ? '<span class="msk-review-dot"></span><span class="msk-review-date">' + relativeDate + '</span>' : '') + '</div></div></div>' + messageHtml + '</div>';
          }

          var reviewsHtml = reviews.map(function(review, index) {
            return buildReviewHtml(review, index);
          }).join('');

          // Build sort dropdown
          var sortOptions = [
            { value: 'recent', label: t.mostRecent },
            { value: 'highest', label: t.highestRated },
            { value: 'lowest', label: t.lowestRated }
          ];

          var sortDropdownHtml = '<div class="msk-reviews-sort-container">' +
            '<button class="msk-reviews-sort" id="msk-reviews-sort-btn">' +
            '<span id="msk-sort-label">' + t.mostRecent + '</span>' +
            '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5l3 3 3-3"/></svg>' +
            '</button>' +
            '<div class="msk-reviews-sort-dropdown" id="msk-reviews-sort-dropdown">' +
            sortOptions.map(function(opt) {
              return '<div class="msk-sort-option' + (opt.value === 'recent' ? ' msk-sort-option-active' : '') + '" data-sort="' + opt.value + '">' + opt.label + '</div>';
            }).join('') +
            '</div></div>';

          reviewsEl.innerHTML = '<div class="msk-reviews-header"><h2 class="msk-reviews-title">' + reviews.length + ' ' + reviewsTitle + '</h2>' + sortDropdownHtml + '</div><div class="msk-reviews-list" id="msk-reviews-list">' + reviewsHtml + '</div>';

          // Sort functionality
          setTimeout(function() {
            var sortBtn = document.getElementById('msk-reviews-sort-btn');
            var sortDropdown = document.getElementById('msk-reviews-sort-dropdown');
            var sortLabel = document.getElementById('msk-sort-label');
            var reviewsListEl = document.getElementById('msk-reviews-list');

            if (sortBtn && sortDropdown && reviewsListEl) {
              // Toggle dropdown
              sortBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                sortDropdown.classList.toggle('msk-sort-dropdown-open');
              });

              // Close on outside click
              document.addEventListener('click', function() {
                sortDropdown.classList.remove('msk-sort-dropdown-open');
              });

              // Sort options click
              var sortOptionEls = sortDropdown.querySelectorAll('.msk-sort-option');
              sortOptionEls.forEach(function(optEl) {
                optEl.addEventListener('click', function(e) {
                  e.stopPropagation();
                  var sortType = this.getAttribute('data-sort');
                  var sortedReviews = originalReviews.slice();

                  // Update active state
                  sortOptionEls.forEach(function(el) { el.classList.remove('msk-sort-option-active'); });
                  this.classList.add('msk-sort-option-active');

                  // Sort reviews
                  if (sortType === 'highest') {
                    sortedReviews.sort(function(a, b) { return b.rating - a.rating; });
                    sortLabel.textContent = t.highestRated;
                  } else if (sortType === 'lowest') {
                    sortedReviews.sort(function(a, b) { return a.rating - b.rating; });
                    sortLabel.textContent = t.lowestRated;
                  } else {
                    // Most recent (original order, assuming reviews are already sorted by date)
                    sortLabel.textContent = t.mostRecent;
                  }

                  // Re-render reviews
                  reviewsListEl.innerHTML = sortedReviews.map(function(review, index) {
                    return buildReviewHtml(review, index);
                  }).join('');

                  // Close dropdown
                  sortDropdown.classList.remove('msk-sort-dropdown-open');

                  log.info('Reviews sorted by:', sortType);
                });
              });
            }
          }, 100);
        }
      }
      
      log.success('Content render complete!');
      return true;
    }
  };
  
  log.info('MSKContent loaded and ready');
})();
