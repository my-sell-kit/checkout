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
    en: { whatsIncluded: "What's included", reviews: "reviews", searchReviews: "Search all reviews", mostRecent: "Most recent", verified: "Verified" },
    fr: { whatsIncluded: "Ce qui est inclus", reviews: "avis", searchReviews: "Rechercher dans les avis", mostRecent: "Plus récents", verified: "Vérifié" },
    es: { whatsIncluded: "Qué incluye", reviews: "reseñas", searchReviews: "Buscar reseñas", mostRecent: "Más recientes", verified: "Verificado" },
    de: { whatsIncluded: "Was enthalten ist", reviews: "Bewertungen", searchReviews: "Bewertungen durchsuchen", mostRecent: "Neueste", verified: "Verifiziert" },
    it: { whatsIncluded: "Cosa è incluso", reviews: "recensioni", searchReviews: "Cerca recensioni", mostRecent: "Più recenti", verified: "Verificato" },
    pt: { whatsIncluded: "O que está incluído", reviews: "avaliações", searchReviews: "Pesquisar avaliações", mostRecent: "Mais recentes", verified: "Verificado" },
    nl: { whatsIncluded: "Wat is inbegrepen", reviews: "beoordelingen", searchReviews: "Zoek beoordelingen", mostRecent: "Meest recent", verified: "Geverifieerd" },
    ja: { whatsIncluded: "含まれるもの", reviews: "レビュー", searchReviews: "レビューを検索", mostRecent: "最新", verified: "認証済み" }
  };
  
  function detectLanguage() {
    var lang = (navigator.language || navigator.userLanguage || 'en').split('-')[0].toLowerCase();
    return TRANSLATIONS[lang] ? lang : 'en';
  }
  
  var currentLang = detectLanguage();
  var t = TRANSLATIONS[currentLang];
  
  // ========== HELPER FUNCTIONS ==========
  function decodeBase64Html(base64Str) {
    try {
      var binaryString = atob(base64Str);
      var bytes = new Uint8Array(binaryString.length);
      for (var i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
      try { return atob(base64Str); } catch (e2) { return ''; }
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
      
      // HTML Content
      if (contentEl && isValidValue(config.htmlContent)) {
        log.info('Injecting HTML content');
        contentEl.innerHTML = decodeBase64Html(config.htmlContent);
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
            return '<div class="msk-file-block"><div class="msk-file-info"><span class="msk-file-name">' + name + '</span>' + (ext ? '<span class="msk-file-ext">' + ext + '</span>' : '') + '</div><svg class="msk-file-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></div>';
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
          var searchPlaceholder = isValidValue(config.reviewsSearchPlaceholder) ? config.reviewsSearchPlaceholder : t.searchReviews;
          var sortLabel = isValidValue(config.reviewsSortLabel) ? config.reviewsSortLabel : t.mostRecent;
          var verifiedLabel = isValidValue(config.reviewsVerifiedLabel) ? config.reviewsVerifiedLabel : t.verified;
          
          var reviewsHtml = reviews.map(function(review, index) {
            var initials = getInitials(review.name);
            var relativeDate = formatRelativeDate(review.date);
            var starsHtml = generateStars(review.rating);
            var verifiedBadge = review.verified ? '<span class="msk-review-verified"><svg class="msk-review-verified-icon" viewBox="0 0 12 12" fill="currentColor"><path d="M6 0C2.69 0 0 2.69 0 6s2.69 6 6 6 6-2.69 6-6S9.31 0 6 0zm-.75 9L2.5 6.25l1.06-1.06 1.69 1.69 3.69-3.69L10 4.25 5.25 9z"/></svg>' + verifiedLabel + '</span>' : '';
            var messageHtml = review.message ? '<p class="msk-review-message">' + review.message + '</p>' : '';
            return '<div class="msk-review-item" data-review-index="' + index + '"><div class="msk-review-header"><div class="msk-review-avatar">' + initials + '</div><div class="msk-review-author-info"><div class="msk-review-author-row"><span class="msk-review-author">' + review.name + '</span>' + verifiedBadge + '</div><div class="msk-review-meta"><div class="msk-review-stars">' + starsHtml + '</div>' + (relativeDate ? '<span class="msk-review-dot"></span><span class="msk-review-date">' + relativeDate + '</span>' : '') + '</div></div></div>' + messageHtml + '</div>';
          }).join('');
          
          reviewsEl.innerHTML = '<div class="msk-reviews-header"><h2 class="msk-reviews-title">' + reviews.length + ' ' + reviewsTitle + '</h2><button class="msk-reviews-sort">' + sortLabel + '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5l3 3 3-3"/></svg></button></div><div class="msk-reviews-search"><div class="msk-reviews-search-wrapper"><svg class="msk-reviews-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><input type="text" class="msk-reviews-search-input" placeholder="' + searchPlaceholder + '" id="msk-reviews-search-input"></div></div><div class="msk-reviews-list" id="msk-reviews-list">' + reviewsHtml + '</div>';
          
          // Search functionality
          setTimeout(function() {
            var searchInput = document.getElementById('msk-reviews-search-input');
            var reviewsListEl = document.getElementById('msk-reviews-list');
            if (searchInput && reviewsListEl) {
              searchInput.addEventListener('input', function(e) {
                var query = e.target.value.toLowerCase().trim();
                var items = reviewsListEl.querySelectorAll('.msk-review-item');
                items.forEach(function(item) { 
                  item.style.display = (!query || item.textContent.toLowerCase().indexOf(query) !== -1) ? 'block' : 'none'; 
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
