/**
 * CineMatch - OMDb Complete Application Script
 * -------------------------------------------------------------
 * PASTE YOUR OMDB API KEY BELOW (or enter it via the ⚙️ in the UI):
 */
const OMDB_CONFIG = {
  API_KEY: '', // <-- Paste your OMDb API key here
  BASE_URL: 'https://www.omdbapi.com/',
  FALLBACK_POSTER: 'https://placehold.co/500x750/162032/f8fafc?text=No+Poster+Available',
  FALLBACK_BACKDROP: 'https://placehold.co/1920x1080/0b0f19/64748b?text=CineMatch+Movies'
};

function getActiveApiKey() {
  if (OMDB_CONFIG.API_KEY && OMDB_CONFIG.API_KEY.trim() !== '') {
    return OMDB_CONFIG.API_KEY.trim();
  }
  return localStorage.getItem('cinematch_omdb_api_key') || '';
}

function saveApiKey(key) {
  if (!key || !key.trim()) return false;
  localStorage.setItem('cinematch_omdb_api_key', key.trim());
  return true;
}

function clearApiKey() {
  localStorage.removeItem('cinematch_omdb_api_key');
}

// -------------------------------------------------------------
// OMDb API Service
// -------------------------------------------------------------
const OMDB_API = {
  CURATED_LISTS: {
    TRENDING_IDS: ['tt15398776', 'tt1517268', 'tt1160419', 'tt15239678', 'tt9362722', 'tt1877830', 'tt1375666', 'tt0816692'],
    TOP_RATED_IDS: ['tt0111161', 'tt0068646', 'tt0468569', 'tt0071562', 'tt0050083', 'tt0108052', 'tt0167260', 'tt0110912']
  },

  async request(params = {}) {
    const apiKey = getActiveApiKey();
    if (!apiKey) {
      const err = new Error('No OMDb API key configured. Please enter your key in Settings.');
      err.code = 'NO_API_KEY';
      throw err;
    }

    const queryParams = new URLSearchParams({ apikey: apiKey, ...params });
    const url = `${OMDB_CONFIG.BASE_URL}?${queryParams.toString()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);

    const data = await res.json();
    if (data.Response === 'False') {
      const msg = data.Error || 'Request failed';
      if (msg.toLowerCase().includes('key') || msg.toLowerCase().includes('invalid')) {
        const err = new Error('Invalid OMDb API Key. Please verify your credentials.');
        err.code = 'INVALID_API_KEY';
        throw err;
      }
      if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('too many')) {
        return { Search: [], totalResults: '0', Response: 'False' };
      }
      throw new Error(msg);
    }
    return data;
  },

  async search(query, page = 1) {
    if (!query || !query.trim()) return { results: [], total_pages: 0 };
    const data = await this.request({ s: query.trim(), type: 'movie', page });
    const results = (data.Search || []).map(item => this.normalizeMovie(item));
    const totalResults = parseInt(data.totalResults || '0', 10);
    return { results, total_pages: Math.ceil(totalResults / 10), total_results: totalResults };
  },

  async getDetails(imdbId) {
    const data = await this.request({ i: imdbId, plot: 'full' });
    return this.normalizeMovie(data);
  },

  async getTrending(page = 1) {
    if (page === 1) {
      const results = await Promise.all(this.CURATED_LISTS.TRENDING_IDS.map(id => this.getDetails(id)));
      return { results, total_pages: 3 };
    }
    const terms = ['Marvel', 'Batman', 'Avengers', 'Star Wars'];
    return await this.search(terms[(page - 1) % terms.length], 1);
  },

  async getTopRated(page = 1) {
    if (page === 1) {
      const results = await Promise.all(this.CURATED_LISTS.TOP_RATED_IDS.map(id => this.getDetails(id)));
      return { results, total_pages: 2 };
    }
    return await this.search('Classic', page);
  },

  async getByGenre(genre, page = 1) {
    return await this.search(genre, page);
  },

  normalizeMovie(item) {
    if (!item) return null;
    const poster = (item.Poster && item.Poster !== 'N/A') ? item.Poster : null;
    const rating = (item.imdbRating && item.imdbRating !== 'N/A') ? parseFloat(item.imdbRating) : null;
    const genres = (item.Genre && item.Genre !== 'N/A') ? item.Genre.split(', ') : [];
    const actors = (item.Actors && item.Actors !== 'N/A') ? item.Actors.split(', ') : [];

    return {
      id: item.imdbID,
      imdbID: item.imdbID,
      title: item.Title || 'Untitled Movie',
      poster_path: poster,
      backdrop_path: poster,
      vote_average: rating,
      vote_count: item.imdbVotes || '0',
      release_date: item.Released || item.Year || '',
      year: item.Year || '',
      overview: (item.Plot && item.Plot !== 'N/A') ? item.Plot : 'No synopsis available.',
      genre_names: genres,
      runtime: (item.Runtime && item.Runtime !== 'N/A') ? item.Runtime : 'N/A',
      director: (item.Director && item.Director !== 'N/A') ? item.Director : 'N/A',
      actors: actors
    };
  },

  getImageUrl(path, type = 'poster') {
    if (!path || path === 'N/A') {
      return type === 'backdrop' ? OMDB_CONFIG.FALLBACK_BACKDROP : OMDB_CONFIG.FALLBACK_POSTER;
    }
    return path;
  }
};

// -------------------------------------------------------------
// Application Controller & State
// -------------------------------------------------------------
(function () {
  'use strict';

  const PRESET_GENRES = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller'];

  const state = {
    activeTab: 'home',
    selectedGenre: null,
    searchQuery: '',
    currentPage: 1,
    totalPages: 1,
    isLoading: false,
    genres: PRESET_GENRES,
    currentMovies: [],
    featuredMovie: null,
    watchlist: [],
    searchDebounceTimer: null
  };

  const dom = {
    navLinks: document.querySelectorAll('.nav-link'),
    watchlistBadge: document.getElementById('watchlist-badge'),
    btnOpenApiKeyModal: document.getElementById('btn-api-key-modal'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    navMenu: document.getElementById('nav-menu'),

    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    searchForm: document.getElementById('search-form'),

    heroSection: document.getElementById('hero-section'),
    heroBackdrop: document.getElementById('hero-backdrop'),
    heroTitle: document.getElementById('hero-title'),
    heroOverview: document.getElementById('hero-overview'),
    heroRating: document.getElementById('hero-rating'),
    heroRelease: document.getElementById('hero-release'),
    heroDetailsBtn: document.getElementById('hero-details-btn'),
    heroWatchlistBtn: document.getElementById('hero-watchlist-btn'),

    genreChipsContainer: document.getElementById('genre-chips'),
    sectionTitle: document.getElementById('section-title'),
    movieGrid: document.getElementById('movie-grid'),
    loadMoreContainer: document.getElementById('load-more-container'),
    loadMoreBtn: document.getElementById('load-more-btn'),

    statusContainer: document.getElementById('status-container'),
    toastContainer: document.getElementById('toast-container'),

    movieModal: document.getElementById('movie-modal'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    modalPoster: document.getElementById('modal-poster'),
    modalTitle: document.getElementById('modal-title'),
    modalTagline: document.getElementById('modal-tagline'),
    modalRating: document.getElementById('modal-rating'),
    modalReleaseDate: document.getElementById('modal-release'),
    modalRuntime: document.getElementById('modal-runtime'),
    modalGenres: document.getElementById('modal-genres'),
    modalOverview: document.getElementById('modal-overview'),
    modalCastList: document.getElementById('modal-cast-list'),
    modalTrailerWrapper: document.getElementById('modal-trailer-wrapper'),
    modalTrailerLink: document.getElementById('modal-trailer-link'),
    modalWatchlistBtn: document.getElementById('modal-watchlist-btn'),
    modalCloseBtn: document.getElementById('modal-close-btn'),

    apiKeyModal: document.getElementById('api-key-modal'),
    apiKeyInput: document.getElementById('api-key-input'),
    btnSaveApiKey: document.getElementById('btn-save-api-key'),
    btnClearApiKey: document.getElementById('btn-clear-api-key'),
    apiKeyStatusMsg: document.getElementById('api-key-status-msg'),
    apiKeyModalCloseBtn: document.getElementById('api-key-modal-close')
  };

  async function init() {
    loadWatchlist();
    renderGenreChips();
    setupEventListeners();

    const apiKey = getActiveApiKey();
    if (!apiKey) {
      showApiKeyModal(true);
      renderStatusMessage('Welcome to CineMatch! Please set up your free OMDb API key.', 'info', 'Configure API Key', () => showApiKeyModal(false));
      return;
    }
    await loadInitialData();
  }

  async function loadInitialData() {
    try {
      showLoading(true, true);
      await loadHeroMovie();
      await fetchAndDisplayMovies(true);
    } catch (err) {
      handleError(err);
    } finally {
      showLoading(false);
    }
  }

  function loadWatchlist() {
    try {
      const stored = localStorage.getItem('cinematch_omdb_watchlist');
      state.watchlist = stored ? JSON.parse(stored) : [];
    } catch (_) { state.watchlist = []; }
    updateWatchlistBadge();
  }

  function saveWatchlist() {
    try {
      localStorage.setItem('cinematch_omdb_watchlist', JSON.stringify(state.watchlist));
    } catch (_) {}
    updateWatchlistBadge();
  }

  function isMovieInWatchlist(movieId) {
    return state.watchlist.some(m => String(m.id) === String(movieId));
  }

  function toggleWatchlist(movie) {
    const id = String(movie.id || movie.imdbID);
    const idx = state.watchlist.findIndex(m => String(m.id) === id);

    if (idx > -1) {
      state.watchlist.splice(idx, 1);
      saveWatchlist();
      showToast(`Removed "${movie.title}" from Watchlist`, 'info');
      updateAllWatchlistButtons(id, false);
      if (state.activeTab === 'watchlist') renderWatchlist();
      return false;
    } else {
      state.watchlist.unshift({
        id,
        title: movie.title,
        poster_path: movie.poster_path,
        vote_average: movie.vote_average,
        release_date: movie.release_date,
        year: movie.year,
        genre_names: movie.genre_names || [],
        overview: movie.overview
      });
      saveWatchlist();
      showToast(`Added "${movie.title}" to Watchlist`, 'success');
      updateAllWatchlistButtons(id, true);
      return true;
    }
  }

  function updateWatchlistBadge() {
    const count = state.watchlist.length;
    dom.watchlistBadge.textContent = count;
    dom.watchlistBadge.style.display = count > 0 ? 'inline-block' : 'none';
  }

  function updateAllWatchlistButtons(movieId, inList) {
    document.querySelectorAll(`.card-watchlist-btn[data-id="${movieId}"]`).forEach(btn => {
      btn.classList.toggle('active', inList);
      btn.innerHTML = inList ? '♥' : '♡';
    });
    if (state.featuredMovie && String(state.featuredMovie.id) === String(movieId)) {
      dom.heroWatchlistBtn.classList.toggle('active', inList);
      dom.heroWatchlistBtn.innerHTML = inList ? '<span>✓</span> In Watchlist' : '<span>+</span> Add to Watchlist';
    }
    if (dom.movieModal.classList.contains('active') && dom.modalWatchlistBtn.dataset.id === String(movieId)) {
      dom.modalWatchlistBtn.classList.toggle('active', inList);
      dom.modalWatchlistBtn.innerHTML = inList ? '<span>✓</span> Saved in Watchlist' : '<span>+</span> Add to Watchlist';
    }
  }

  async function loadHeroMovie() {
    try {
      const movie = await OMDB_API.getDetails('tt15398776'); // Oppenheimer
      if (movie && movie.title) {
        state.featuredMovie = movie;
        dom.heroSection.style.display = 'block';
        dom.heroBackdrop.style.backgroundImage = `url('${OMDB_API.getImageUrl(movie.poster_path, 'backdrop')}')`;
        dom.heroTitle.textContent = movie.title;
        dom.heroOverview.textContent = movie.overview;
        dom.heroRating.textContent = `★ ${movie.vote_average ? movie.vote_average.toFixed(1) : 'NR'}`;
        dom.heroRelease.textContent = movie.year;
        dom.heroDetailsBtn.onclick = () => openMovieDetails(movie.id);
        dom.heroWatchlistBtn.onclick = () => toggleWatchlist(movie);
        updateAllWatchlistButtons(movie.id, isMovieInWatchlist(movie.id));
      }
    } catch (_) {
      dom.heroSection.style.display = 'none';
    }
  }

  async function fetchAndDisplayMovies(resetPage = false) {
    if (state.isLoading) return;
    if (resetPage) {
      state.currentPage = 1;
      state.currentMovies = [];
      dom.movieGrid.innerHTML = '';
      clearStatusMessage();
    }

    if (state.activeTab === 'watchlist') {
      renderWatchlist();
      return;
    }

    try {
      state.isLoading = true;
      showLoading(true, resetPage);
      let data;

      if (state.searchQuery.trim() !== '') {
        dom.sectionTitle.textContent = `Search Results for "${state.searchQuery}"`;
        data = await OMDB_API.search(state.searchQuery, state.currentPage);
      } else if (state.selectedGenre) {
        dom.sectionTitle.textContent = `${state.selectedGenre} Movies`;
        data = await OMDB_API.getByGenre(state.selectedGenre, state.currentPage);
      } else if (state.activeTab === 'trending') {
        dom.sectionTitle.textContent = 'Popular Blockbusters';
        data = await OMDB_API.getTrending(state.currentPage);
      } else if (state.activeTab === 'top_rated') {
        dom.sectionTitle.textContent = 'All-Time IMDb Classics';
        data = await OMDB_API.getTopRated(state.currentPage);
      } else {
        dom.sectionTitle.textContent = 'Discover Movies';
        data = await OMDB_API.getTrending(state.currentPage);
      }

      state.totalPages = data.total_pages || 1;
      const results = data.results || [];

      if (results.length === 0 && state.currentPage === 1) {
        renderStatusMessage('No movies found for your selection. Try another title!', 'empty');
        dom.loadMoreContainer.style.display = 'none';
        return;
      }

      state.currentMovies = resetPage ? results : [...state.currentMovies, ...results];
      renderMovieCards(results, !resetPage);
      dom.loadMoreContainer.style.display = (state.currentPage < state.totalPages && state.currentPage < 10) ? 'flex' : 'none';
    } catch (err) {
      handleError(err);
    } finally {
      state.isLoading = false;
      showLoading(false);
    }
  }

  function renderGenreChips() {
    dom.genreChipsContainer.innerHTML = '';
    const all = document.createElement('button');
    all.className = `genre-chip ${state.selectedGenre === null ? 'active' : ''}`;
    all.textContent = 'All Genres';
    all.onclick = () => selectGenre(null);
    dom.genreChipsContainer.appendChild(all);

    state.genres.forEach(g => {
      const chip = document.createElement('button');
      chip.className = `genre-chip ${state.selectedGenre === g ? 'active' : ''}`;
      chip.textContent = g;
      chip.onclick = () => selectGenre(g);
      dom.genreChipsContainer.appendChild(chip);
    });
  }

  function selectGenre(genre) {
    if (state.selectedGenre === genre && genre !== null) return;
    state.selectedGenre = genre;
    state.searchQuery = '';
    dom.searchInput.value = '';
    dom.searchClearBtn.style.display = 'none';
    renderGenreChips();
    fetchAndDisplayMovies(true);
  }

  function renderMovieCards(movies, append = false) {
    if (!append) dom.movieGrid.innerHTML = '';
    const frag = document.createDocumentFragment();

    movies.forEach(movie => {
      const card = document.createElement('div');
      card.className = 'movie-card';
      const poster = OMDB_API.getImageUrl(movie.poster_path, 'poster');
      const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'NR';
      const year = movie.year || (movie.release_date ? movie.release_date.split('-')[0] : 'N/A');
      const genre = (movie.genre_names && movie.genre_names.length) ? movie.genre_names[0] : 'Movie';
      const inList = isMovieInWatchlist(movie.id);

      card.innerHTML = `
        <div class="card-media">
          <img src="${poster}" alt="${escapeHtml(movie.title)}" loading="lazy" />
          <button class="card-watchlist-btn ${inList ? 'active' : ''}" data-id="${movie.id}">
            ${inList ? '♥' : '♡'}
          </button>
          <div class="card-rating-badge">★ ${rating}</div>
        </div>
        <div class="card-body">
          <h3 class="card-title" title="${escapeHtml(movie.title)}">${escapeHtml(movie.title)}</h3>
          <div class="card-meta">
            <span>${year}</span>
            <span>${escapeHtml(genre)}</span>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-watchlist-btn')) {
          e.stopPropagation();
          toggleWatchlist(movie);
          return;
        }
        openMovieDetails(movie.id);
      });

      frag.appendChild(card);
    });

    dom.movieGrid.appendChild(frag);
  }

  function renderWatchlist() {
    clearStatusMessage();
    dom.sectionTitle.textContent = `My Watchlist (${state.watchlist.length})`;
    dom.loadMoreContainer.style.display = 'none';

    if (state.watchlist.length === 0) {
      renderStatusMessage('Your watchlist is empty. Browse movies and save your favorites!', 'empty', 'Explore Movies', () => switchTab('trending'));
      dom.movieGrid.innerHTML = '';
      return;
    }
    renderMovieCards(state.watchlist, false);
  }

  async function openMovieDetails(movieId) {
    try {
      dom.movieModal.classList.add('active');
      document.body.style.overflow = 'hidden';

      const movie = await OMDB_API.getDetails(movieId);
      dom.modalBackdrop.style.backgroundImage = `url('${OMDB_API.getImageUrl(movie.poster_path, 'backdrop')}')`;
      dom.modalPoster.src = OMDB_API.getImageUrl(movie.poster_path, 'poster');
      dom.modalTitle.textContent = movie.title;
      dom.modalTagline.textContent = movie.director !== 'N/A' ? `Directed by ${movie.director}` : '';
      dom.modalRating.textContent = `★ ${movie.vote_average ? movie.vote_average.toFixed(1) : 'NR'} (${movie.vote_count} votes)`;
      dom.modalReleaseDate.textContent = movie.release_date;
      dom.modalRuntime.textContent = movie.runtime;

      dom.modalGenres.innerHTML = '';
      (movie.genre_names || []).forEach(name => {
        const badge = document.createElement('span');
        badge.className = 'modal-genre-tag';
        badge.textContent = name;
        dom.modalGenres.appendChild(badge);
      });

      dom.modalOverview.textContent = movie.overview;
      dom.modalWatchlistBtn.dataset.id = String(movie.id);
      dom.modalWatchlistBtn.onclick = () => toggleWatchlist(movie);
      updateAllWatchlistButtons(movie.id, isMovieInWatchlist(movie.id));

      dom.modalCastList.innerHTML = '';
      (movie.actors || []).forEach(name => {
        const item = document.createElement('div');
        item.className = 'cast-card';
        item.innerHTML = `<div class="cast-avatar">${escapeHtml(name.charAt(0))}</div><div class="cast-name">${escapeHtml(name)}</div>`;
        dom.modalCastList.appendChild(item);
      });

      dom.modalTrailerLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' trailer')}`;
    } catch (err) {
      showToast('Could not load movie details', 'error');
      closeMovieModal();
    }
  }

  function closeMovieModal() {
    dom.movieModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function showApiKeyModal() {
    const key = getActiveApiKey();
    dom.apiKeyInput.value = key;
    dom.apiKeyStatusMsg.innerHTML = key ? '<span style="color:#34d399">✓ Key active</span>' : '<span style="color:#fbbf24">⚠ No Key set</span>';
    dom.btnClearApiKey.style.display = key ? 'inline-block' : 'none';
    dom.apiKeyModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeApiKeyModal() {
    dom.apiKeyModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  async function handleSaveApiKey() {
    const key = dom.apiKeyInput.value.trim();
    if (!key) return showToast('Please enter an OMDb API key.', 'error');
    saveApiKey(key);
    showToast('OMDb Key saved successfully!', 'success');
    closeApiKeyModal();
    clearStatusMessage();
    await loadInitialData();
  }

  function showLoading(show, reset = false) {
    if (show && reset) {
      dom.movieGrid.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
    }
    dom.loadMoreBtn.textContent = show ? 'Loading...' : 'Load More Movies';
  }

  function renderStatusMessage(msg, type = 'info', btnTxt = null, btnAct = null) {
    dom.statusContainer.style.display = 'block';
    dom.statusContainer.innerHTML = `
      <div class="status-card status-${type}">
        <p>${escapeHtml(msg)}</p>
        ${btnTxt ? `<button class="btn btn-primary status-action-btn">${escapeHtml(btnTxt)}</button>` : ''}
      </div>
    `;
    if (btnTxt && btnAct) dom.statusContainer.querySelector('.status-action-btn').onclick = btnAct;
  }

  function clearStatusMessage() {
    dom.statusContainer.style.display = 'none';
  }

  function handleError(err) {
    if (err.code === 'NO_API_KEY' || err.code === 'INVALID_API_KEY') {
      renderStatusMessage(err.message, 'error', 'Configure API Key', () => showApiKeyModal());
    } else {
      renderStatusMessage(err.message || 'Error connecting to OMDb.', 'error', 'Retry', () => fetchAndDisplayMovies(true));
    }
  }

  function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setupEventListeners() {
    dom.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(link.dataset.tab);
        dom.navMenu.classList.remove('active');
      });
    });

    dom.mobileMenuBtn.addEventListener('click', () => dom.navMenu.classList.toggle('active'));
    dom.btnOpenApiKeyModal.addEventListener('click', () => showApiKeyModal());
    dom.apiKeyModalCloseBtn.addEventListener('click', closeApiKeyModal);
    dom.btnSaveApiKey.addEventListener('click', handleSaveApiKey);
    dom.btnClearApiKey.addEventListener('click', () => {
      clearApiKey();
      showToast('Key cleared', 'info');
      closeApiKeyModal();
      handleError({ code: 'NO_API_KEY', message: 'Please add a valid OMDb key.' });
    });

    dom.searchInput.addEventListener('input', (e) => {
      const q = e.target.value;
      dom.searchClearBtn.style.display = q.length ? 'block' : 'none';
      clearTimeout(state.searchDebounceTimer);
      state.searchDebounceTimer = setTimeout(() => {
        state.searchQuery = q;
        state.selectedGenre = null;
        renderGenreChips();
        fetchAndDisplayMovies(true);
      }, 400);
    });

    dom.searchClearBtn.addEventListener('click', () => {
      dom.searchInput.value = '';
      dom.searchClearBtn.style.display = 'none';
      state.searchQuery = '';
      fetchAndDisplayMovies(true);
    });

    dom.searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearTimeout(state.searchDebounceTimer);
      state.searchQuery = dom.searchInput.value;
      state.selectedGenre = null;
      renderGenreChips();
      fetchAndDisplayMovies(true);
    });

    dom.loadMoreBtn.addEventListener('click', () => {
      state.currentPage += 1;
      fetchAndDisplayMovies(false);
    });

    dom.modalCloseBtn.addEventListener('click', closeMovieModal);
    dom.movieModal.addEventListener('click', (e) => { if (e.target === dom.movieModal) closeMovieModal(); });
    dom.apiKeyModal.addEventListener('click', (e) => { if (e.target === dom.apiKeyModal) closeApiKeyModal(); });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeMovieModal(); closeApiKeyModal(); }
    });
  }

  function switchTab(tab) {
    if (state.activeTab === tab && state.searchQuery === '' && state.selectedGenre === null) return;
    state.activeTab = tab;
    state.searchQuery = '';
    state.selectedGenre = null;
    dom.searchInput.value = '';
    dom.searchClearBtn.style.display = 'none';

    dom.navLinks.forEach(link => link.classList.toggle('active', link.dataset.tab === tab));
    dom.heroSection.style.display = (tab === 'home' && state.featuredMovie) ? 'block' : 'none';
    renderGenreChips();
    fetchAndDisplayMovies(true);
  }

  document.addEventListener('DOMContentLoaded', init);
})();