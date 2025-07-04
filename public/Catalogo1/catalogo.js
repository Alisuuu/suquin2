// --- Constants and Configuration ---
const TMDB_API_KEY = '5e5da432e96174227b25086fe8637985';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';
const LANGUAGE = 'pt-BR';
const PLACEHOLDER_PERSON_IMAGE = 'https://placehold.co/185x278/0F071A/F3F4F6?text=Sem+Foto&font=inter';
const PLAYER_BASE_URL_MOVIE = 'https://playerflixapi.com/filme/';
const PLAYER_BASE_URL_SERIES = 'https://playerflixapi.com/serie/';
const FAVORITES_STORAGE_KEY = 'suquin_favorites_v2';
const TMDB_ANIME_KEYWORD_ID = '210024';
const TMDB_JAPAN_COUNTRY_CODE = 'JP';
const companyKeywordMap = {
    'disney': { name: 'Disney', ids: [2, 3, 420, 1] },
    'pixar': { name: 'Pixar', ids: [3] },
    'marvel': { name: 'Marvel', ids: [420] },
    'netflix': { name: 'Netflix', ids: [213] },
    'hbo': { name: 'HBO', ids: [3268, 11073] },
    'warner': { name: 'Warner Bros.', ids: [174, 9993] },
    'universal': { name: 'Universal', ids: [33] },
    'sony': { name: 'Sony', ids: [5] },
    'paramount': { name: 'Paramount', ids: [4] }
};

// --- DOM Element References ---
const pageBackdrop = document.getElementById('pageBackdrop');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const filterToggleButton = document.getElementById('filterToggleButton');
const defaultContentSections = document.getElementById('defaultContentSections');
const moviesResultsGrid = document.getElementById('moviesResultsGrid');
const tvShowsResultsGrid = document.getElementById('tvShowsResultsGrid');
const singleResultsSection = document.getElementById('singleResultsSection');
const singleSectionTitleEl = document.getElementById('singleSectionTitle');
const singleResultsGrid = document.getElementById('singleResultsGrid');
const loader = document.getElementById('loader');
const floatingFavoritesButton = document.getElementById('floatingFavoritesButton');
const searchResultsLoader = document.getElementById('searchResultsLoader');
const popularMoviesLoader = document.getElementById('popularMoviesLoader');
const topRatedTvShowsLoader = document.getElementById('topRatedTvShowsLoader');
const openCalendarBtn = document.getElementById('open-calendar-btn');
const closeCalendarBtn = document.getElementById('close-calendar-btn');

// --- State Variables ---
let activeAppliedGenre = { id: null, name: null, type: null };
let currentFilterTypeSA = 'movie'; 
let selectedGenreSA = { id: null, name: null, type: null }; 
let searchTimeout = null;
let searchCurrentPage = 1;
let filterCurrentPage = 1;
let isLoadingMore = false;
let totalPages = { search: 1, filter: 1 };
let currentContentContext = 'main';
let mainPageBackdropSlideshowInterval = null;
let currentMainPageBackdropIndex = 0;
let mainPageBackdropPaths = [];
let favorites = [];
let currentOpenSwalRef = null;
let popularMoviesCurrentPage = 1;
let popularMoviesTotalPages = 1;
let isLoadingMorePopularMovies = false;
let topRatedTvShowsCurrentPage = 1;
let topRatedTvShowsTotalPages = 1;
let isLoadingMoreTopRatedTvShows = false;

// --- Main Logic ---
let lazyImageObserver;

function setupLazyLoader() {
    const options = {
        root: null,
        rootMargin: '0px 0px 500px 0px',
        threshold: 0.01
    };

    lazyImageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const lazyImage = entry.target;
                lazyImage.src = lazyImage.dataset.src;
                lazyImage.classList.remove('lazy-image');
                lazyImage.onload = () => {
                    lazyImage.style.backgroundColor = 'transparent';
                };
                observer.unobserve(lazyImage);
            }
        });
    }, options);
}

function observeNewImages(container) {
    if (!lazyImageObserver) return;
    const imagesToLoad = container.querySelectorAll('img.lazy-image');
    imagesToLoad.forEach(image => {
        lazyImageObserver.observe(image);
    });
}

function getCompanyConfigForQuery(query) {
    const normalizedQuery = query.toLowerCase().trim();
    if (typeof companyKeywordMap === 'undefined') {
        return null;
    }
    for (const keyword in companyKeywordMap) {
        if (normalizedQuery.includes(keyword)) {
            return companyKeywordMap[keyword];
        }
    }
    return null;
}

function stopMainPageBackdropSlideshow() {
    clearInterval(mainPageBackdropSlideshowInterval);
    mainPageBackdropSlideshowInterval = null;
}

function startMainPageBackdropSlideshow() {
    stopMainPageBackdropSlideshow();
    if (mainPageBackdropPaths.length === 0) {
        updatePageBackground(null);
        return;
    }
    updatePageBackground(mainPageBackdropPaths[currentMainPageBackdropIndex]);
    mainPageBackdropSlideshowInterval = setInterval(() => {
        currentMainPageBackdropIndex = (currentMainPageBackdropIndex + 1) % mainPageBackdropPaths.length;
        updatePageBackground(mainPageBackdropPaths[currentMainPageBackdropIndex]);
    }, 8000);
}

async function fetchTMDB(endpoint, params = {}) {
    const urlParams = new URLSearchParams({ api_key: TMDB_API_KEY, language: LANGUAGE, include_adult: 'false', ...params });
    const url = `${TMDB_BASE_URL}${endpoint}?${urlParams}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ status_message: response.statusText || "Unknown API Error" }));
            return { error: true, status: response.status, message: errorData.status_message };
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

async function loadMainPageContent() {
    showLoader();
    if (defaultContentSections) defaultContentSections.style.display = 'block';
    if (singleResultsSection) singleResultsSection.style.display = 'none';
    if (filterToggleButton) filterToggleButton.classList.remove('active');
    activeAppliedGenre = { id: null, name: null, type: null };
    selectedGenreSA = { id: null, name: null, type: null };
    currentContentContext = 'main';

    popularMoviesCurrentPage = 1; popularMoviesTotalPages = 1; isLoadingMorePopularMovies = false;
    topRatedTvShowsCurrentPage = 1; topRatedTvShowsTotalPages = 1; isLoadingMoreTopRatedTvShows = false;
    if (moviesResultsGrid) moviesResultsGrid.innerHTML = '';
    if (tvShowsResultsGrid) tvShowsResultsGrid.innerHTML = '';
    mainPageBackdropPaths = []; currentMainPageBackdropIndex = 0;

    const moviesPromise = fetchTMDB(`/movie/popular`, { page: popularMoviesCurrentPage });
    const tvShowsPromise = fetchTMDB(`/tv/top_rated`, { page: topRatedTvShowsCurrentPage });
    const [moviesData, tvShowsData] = await Promise.all([moviesPromise, tvShowsPromise]);

    if (moviesResultsGrid) {
        if (moviesData && !moviesData.error && moviesData.results) {
            popularMoviesTotalPages = moviesData.total_pages || 1;
            displayResults(moviesData.results, 'movie', moviesResultsGrid, true);
            moviesData.results.forEach(movie => { if (movie.backdrop_path) mainPageBackdropPaths.push(movie.backdrop_path); });
        } else { moviesResultsGrid.innerHTML = `<p class="text-center col-span-full text-[var(--text-secondary)] py-5">Não foi possível carregar filmes populares. ${moviesData?.message || ''}</p>`; }
    }
    if (tvShowsResultsGrid) {
        if (tvShowsData && !tvShowsData.error && tvShowsData.results) {
            topRatedTvShowsTotalPages = tvShowsData.total_pages || 1;
            displayResults(tvShowsData.results, 'tv', tvShowsResultsGrid, true);
            tvShowsData.results.forEach(show => { if (show.backdrop_path) mainPageBackdropPaths.push(show.backdrop_path); });
        } else { tvShowsResultsGrid.innerHTML = `<p class="text-center col-span-full text-[var(--text-secondary)] py-5">Não foi possível carregar séries populares. ${tvShowsData?.message || ''}</p>`; }
    }
    if (typeof shuffleArray === "function") shuffleArray(mainPageBackdropPaths);
    startMainPageBackdropSlideshow();
    hideLoader();
}

async function loadMorePopularMovies() {
    if (isLoadingMorePopularMovies || popularMoviesCurrentPage >= popularMoviesTotalPages) return;
    isLoadingMorePopularMovies = true;
    if (popularMoviesLoader) popularMoviesLoader.classList.add('loading');

    try {
        popularMoviesCurrentPage++;
        const data = await fetchTMDB('/movie/popular', { page: popularMoviesCurrentPage });
        if (data && !data.error && data.results && data.results.length > 0) {
            displayResults(data.results, 'movie', moviesResultsGrid, false);
            data.results.forEach(movie => { if (movie.backdrop_path && !mainPageBackdropPaths.includes(movie.backdrop_path)) mainPageBackdropPaths.push(movie.backdrop_path); });
            popularMoviesTotalPages = data.total_pages || popularMoviesTotalPages;
        } else if (data && data.error) {
            popularMoviesCurrentPage--;
        }
    } catch (error) {
        console.error("Erro ao carregar mais filmes populares:", error);
        popularMoviesCurrentPage--;
    } finally {
        if (popularMoviesLoader) popularMoviesLoader.classList.remove('loading');
        isLoadingMorePopularMovies = false;
    }
}

async function loadMoreTopRatedTvShows() {
    if (isLoadingMoreTopRatedTvShows || topRatedTvShowsCurrentPage >= topRatedTvShowsTotalPages) return;
    isLoadingMoreTopRatedTvShows = true;
    if (topRatedTvShowsLoader) topRatedTvShowsLoader.classList.add('loading');

    try {
        topRatedTvShowsCurrentPage++;
        const data = await fetchTMDB('/tv/top_rated', { page: topRatedTvShowsCurrentPage });
        if (data && !data.error && data.results && data.results.length > 0) {
            displayResults(data.results, 'tv', tvShowsResultsGrid, false);
            data.results.forEach(show => { if (show.backdrop_path && !mainPageBackdropPaths.includes(show.backdrop_path)) mainPageBackdropPaths.push(show.backdrop_path); });
            topRatedTvShowsTotalPages = data.total_pages || topRatedTvShowsTotalPages;
        } else if (data && data.error) {
            topRatedTvShowsCurrentPage--;
        }
    } catch (error) {
        console.error("Erro ao carregar mais séries populares:", error);
        topRatedTvShowsCurrentPage--;
    } finally {
        if (topRatedTvShowsLoader) topRatedTvShowsLoader.classList.remove('loading');
        isLoadingMoreTopRatedTvShows = false;
    }
}

async function performSearch(query) {
    const trimmedQuery = query ? query.trim().toLowerCase() : '';
    if (trimmedQuery === 'sq') { window.location.href = '../Hyper/hyper.html'; return; }
    if (trimmedQuery === 'yt') { window.location.href = '../Yt/yt.html'; return; }
    if (trimmedQuery === 'suquin') { window.location.href = '../game/index.html'; return; }
    if (trimmedQuery === 'lk') { window.location.href = '../links/links.html'; return; }

    stopMainPageBackdropSlideshow();
    if (pageBackdrop.style.opacity !== '0') updatePageBackground(null);
    showLoader();
    activeAppliedGenre = { id: null, name: null, type: null };
    selectedGenreSA = { id: null, name: null, type: null };
    if (filterToggleButton) filterToggleButton.classList.remove('active');
    searchCurrentPage = 1;
    totalPages.search = 1;
    currentContentContext = 'search';
    isLoadingMore = false;

    if (!query || !query.trim()) {
        loadMainPageContent();
        hideLoader();
        return;
    }

    if (defaultContentSections) defaultContentSections.style.display = 'none';
    if (singleResultsSection) singleResultsSection.style.display = 'block';
    if (singleResultsGrid) singleResultsGrid.innerHTML = '';

    let finalDisplayResults = [];
    let searchTitle = `Resultados para: "${query}"`;
    const companyConfig = getCompanyConfigForQuery(query);
    const fetchPromises = [fetchTMDB('/search/multi', { query: query, page: searchCurrentPage })];
    if (companyConfig) {
        searchTitle = `Conteúdo de ${companyConfig.name} (e mais resultados para "${query}")`;
        const companyIdsString = companyConfig.ids.join('|');
        fetchPromises.push(fetchTMDB(`/discover/movie`, { with_companies: companyIdsString, page: 1, sort_by: 'popularity.desc' }));
        fetchPromises.push(fetchTMDB(`/discover/tv`, { with_companies: companyIdsString, page: 1, sort_by: 'popularity.desc' }));
    }
    if (singleSectionTitleEl) singleSectionTitleEl.textContent = searchTitle;

    try {
        const [multiSearchData, companyMovieData, companyTvData] = await Promise.all(fetchPromises);
        
        if (multiSearchData && !multiSearchData.error && multiSearchData.results) {
            finalDisplayResults.push(...multiSearchData.results.filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path));
            totalPages.search = multiSearchData.total_pages || 1;
        }

        if (companyMovieData && !companyMovieData.error && companyMovieData.results) {
            finalDisplayResults.push(...companyMovieData.results.filter(item => item.poster_path).map(item => ({ ...item, media_type: 'movie' })));
        }

        if (companyTvData && !companyTvData.error && companyTvData.results) {
            finalDisplayResults.push(...companyTvData.results.filter(item => item.poster_path).map(item => ({ ...item, media_type: 'tv' })));
        }

        const uniqueResults = Array.from(new Map(finalDisplayResults.map(item => [item.id + (item.media_type || ''), item])).values());
        uniqueResults.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

        if (singleResultsGrid) {
            displayResults(uniqueResults, null, singleResultsGrid, true);
            if (uniqueResults.length === 0) {
                const baseErrorMsg = companyConfig ? `Nenhum conteúdo de ${companyConfig.name} ou resultados diretos encontrados.` : `Nenhum filme ou série relevante encontrado.`;
                singleResultsGrid.innerHTML = `<p class="text-center col-span-full">${multiSearchData?.error ? multiSearchData.message : baseErrorMsg}</p>`;
            }
        }
    } catch (error) {
        if (singleResultsGrid) singleResultsGrid.innerHTML = `<p class="text-center col-span-full">Não foi possível realizar a busca. ${error.message || 'Tente novamente.'}</p>`;
    } finally {
        hideLoader();
    }
}

async function applyGenreFilterFromSA() {
    stopMainPageBackdropSlideshow();
    if (pageBackdrop.style.opacity !== '0') updatePageBackground(null);
    if (!selectedGenreSA.id && selectedGenreSA.type !== 'anime') {
        activeAppliedGenre = { id: null, name: null, type: null };
        if (filterToggleButton) filterToggleButton.classList.remove('active');
        loadMainPageContent(); return;
    }
    showLoader();
    activeAppliedGenre = { ...selectedGenreSA };
    filterCurrentPage = 1; totalPages.filter = 1; currentContentContext = 'filter';
    isLoadingMore = false;
    if (defaultContentSections) defaultContentSections.style.display = 'none';
    if (singleResultsSection) singleResultsSection.style.display = 'block';
    if (singleResultsGrid) singleResultsGrid.innerHTML = '';

    let params = { sort_by: 'popularity.desc', page: filterCurrentPage };
    let endpointType = activeAppliedGenre.type === 'movie' ? 'movie' : 'tv';
    let titlePrefix = activeAppliedGenre.type === 'movie' ? 'Filmes' : 'Séries';

    if (activeAppliedGenre.id) params.with_genres = activeAppliedGenre.id;
    if (activeAppliedGenre.type === 'anime') {
        titlePrefix = 'Animes';
        params.with_origin_country = TMDB_JAPAN_COUNTRY_CODE;
        params.with_keywords = TMDB_ANIME_KEYWORD_ID;
    }
    
    if (singleSectionTitleEl) singleSectionTitleEl.textContent = `${titlePrefix} do Gênero: ${activeAppliedGenre.name || 'Todos'}`;
    
    const data = await fetchTMDB(`/discover/${endpointType}`, params);

    if (singleResultsGrid) {
        displayResults(data.results, activeAppliedGenre.type, singleResultsGrid, true);
        if (!data.results || data.results.length === 0) {
            singleResultsGrid.innerHTML = `<p class="text-center col-span-full">Nenhum item encontrado para o gênero ${activeAppliedGenre.name || 'selecionado'}.</p>`;
        } else {
            totalPages.filter = data.total_pages || 1;
        }
    }
    hideLoader();
    if (filterToggleButton) filterToggleButton.classList.add('active');
}

async function getItemDetails(itemId, mediaType) {
    return await fetchTMDB(`/${mediaType}/${itemId}`, { 
        append_to_response: 'external_ids,credits,videos,images',
        include_image_language: 'pt,en,null' 
    });
}

function selectBestLogo(logos) {
    if (!logos || logos.length === 0) return null;
    const getScore = (logo) => {
        let score = 0;
        if (logo.file_path.endsWith('.png')) score += 100;
        else if (logo.file_path.endsWith('.svg')) score += 90;
        if (logo.iso_639_1 === 'pt') score += 50;
        else if (logo.iso_639_1 === 'en') score += 40;
        else if (logo.iso_639_1 === null) score += 30; 
        score += (logo.vote_average || 0);
        if (logo.aspect_ratio > 1) score += logo.aspect_ratio;
        return score;
    };
    const scoredLogos = logos.map(logo => ({ ...logo, score: getScore(logo) }));
    scoredLogos.sort((a, b) => b.score - a.score);
    return scoredLogos[0].file_path;
}

function findBestTrailer(videos) {
    if (!videos || !videos.results || videos.results.length === 0) {
        return null;
    }
    const trailers = videos.results.filter(video => video.site === 'YouTube' && video.type === 'Trailer');
    if (trailers.length === 0) {
        const anyVideo = videos.results.find(video => video.site === 'YouTube');
        return anyVideo ? anyVideo.key : null;
    }
    const officialTrailer = trailers.find(t => t.official);
    return officialTrailer ? officialTrailer.key : trailers[0].key;
}

async function openItemModal(itemId, mediaType, backdropPath = null) {
    stopMainPageBackdropSlideshow();
    updatePageBackground(backdropPath);

    currentOpenSwalRef = Swal.fire({
        title: 'Carregando Detalhes...',
        html: '<div class="loader mx-auto my-10" style="width: 40px; height: 40px; border-width: 4px;"></div>',
        showConfirmButton: false, showCloseButton: true, allowOutsideClick: true,
        customClass: { popup: 'swal2-popup swal-details-popup' },
        willClose: () => {
            updatePageBackground(null);
            currentOpenSwalRef = null;
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('type') && urlParams.has('id')) {
                window.history.replaceState({}, document.title, window.location.pathname);
                if (defaultContentSections.style.display === 'none' && singleResultsSection.style.display === 'none') {
                    loadMainPageContent();
                } else if (defaultContentSections.style.display === 'block') {
                    startMainPageBackdropSlideshow();
                }
            } else if (defaultContentSections.style.display === 'block') {
                startMainPageBackdropSlideshow();
            }
        }
    });

    const details = await getItemDetails(itemId, mediaType);
    if (!Swal.isVisible()) return;
    if (!details || details.error) {
        Swal.update({ title: 'Erro', html: `<p class="text-red-400 text-center py-10">${details?.message || 'Não foi possível carregar os detalhes.'}</p>`, showConfirmButton: true, confirmButtonText: 'Fechar' });
        return;
    }
    
    if (!backdropPath && details.backdrop_path) updatePageBackground(details.backdrop_path);

    const imdbId = details.external_ids?.imdb_id;
    const mainPlayerUrl = mediaType === 'movie' && imdbId ? `${PLAYER_BASE_URL_MOVIE}${imdbId}` : (mediaType === 'tv' ? `${PLAYER_BASE_URL_SERIES}${itemId}/1/` : '');
    
    // LÓGICA DE CÓPIA DE LINK
    const shareUrl = `https://alisuuu.github.io/Suquinho/?pagina=Catalogo1%2Findex.html%3Ftype%3D${mediaType}%26id%3D${itemId}`;
    
    const titleText = details.title || details.name || "N/A";
    const coverImagePath = details.backdrop_path ? `${TMDB_IMAGE_BASE_URL}w780${details.backdrop_path}` : (details.poster_path ? `${TMDB_IMAGE_BASE_URL}w780${details.poster_path}` : 'https://placehold.co/1280x720/0A0514/F0F0F0?text=Indispon%C3%ADvel');
    const logoPathForPlayer = selectBestLogo(details.images?.logos);
    const logoHTML = logoPathForPlayer ? `<div class="details-logo-container"><img src="${TMDB_IMAGE_BASE_URL}w500${logoPathForPlayer}" class="details-logo-img" alt="Logo"></div>` : '';
    
    const headerContentHTML = `<div class="details-trailer-container"><div class="trailer-cover"><img src="${coverImagePath}" alt="Capa" class="trailer-cover-img">${logoHTML}<div class="cover-elements-overlay"><div id="modal-play-button" class="play-icon-wrapper"><i class="fas fa-play"></i></div></div></div></div>`;
    
    const overview = details.overview || 'Sinopse não disponível.';
    const releaseDate = details.release_date || details.first_air_date;
    const rating = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';
    const genres = details.genres?.map(g => g.name).join(', ') || 'N/A';
    const runtime = details.runtime || details.episode_run_time?.[0] || null;
    const castSectionHTML = details.credits?.cast?.length > 0 ? `<div class="details-cast-section"><h3 class="details-section-subtitle">Elenco</h3><div class="details-cast-scroller">${details.credits.cast.slice(0, 15).map(p => `<div class="cast-member-card"><img src="${p.profile_path ? TMDB_IMAGE_BASE_URL + 'w185' + p.profile_path : PLACEHOLDER_PERSON_IMAGE}" alt="${p.name}" class="cast-member-photo"><p class="cast-member-name">${p.name}</p><p class="cast-member-character">${p.character}</p></div>`).join('')}</div></div>` : '';
    const isFav = isFavorite(itemId, mediaType);
    
    // BOTÕES DE AÇÃO
    const favoriteButtonHTML = `<button id="modalFavoriteButton" class="modal-favorite-button ${isFav ? 'active' : ''}" data-id="${itemId}" data-type="${mediaType}" title="Favoritos">${isFav ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>'}</button>`;
    const copyLinkButtonHTML = `<button id="modalCopyLinkButton" class="modal-copy-link-button" title="Copiar Link"><i class="fas fa-link"></i></button>`;
    const trailerKey = findBestTrailer(details.videos);
    const trailerButtonHTML = trailerKey ? `<button id="modalTrailerButton" class="modal-trailer-button" title="Ver Trailer"><i class="fas fa-film"></i> Trailer</button>` : '';

    const detailsHTML = `
        <div class="swal-details-content">
            ${headerContentHTML}
            <div class="details-info-area">
                <h2 class="details-content-title">${titleText}</h2>
                <div class="details-meta-info">
                    ${releaseDate ? `<span><i class="fas fa-calendar-alt"></i> ${new Date(releaseDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>` : ''}
                    ${rating !== 'N/A' ? `<span><i class="fas fa-star"></i> ${rating}/10</span>` : ''}
                    ${runtime ? `<span><i class="fas fa-clock"></i> ${runtime} min</span>` : ''}
                </div>
                <p class="details-genres"><strong>Gêneros:</strong> ${genres}</p>
                <div class="modal-actions-wrapper">${favoriteButtonHTML}${copyLinkButtonHTML}${trailerButtonHTML}</div>
                <div id="trailer-container"></div>
                <h3 class="details-section-subtitle" style="padding-left:0; margin-top: 16px;">Sinopse</h3>
                <p class="details-overview">${overview}</p>
            </div>
            ${castSectionHTML}
        </div>`;

    Swal.update({ title: '', html: detailsHTML, showConfirmButton: false });

    // EVENT LISTENERS DOS BOTÕES
    document.getElementById('modal-play-button')?.addEventListener('click', () => mainPlayerUrl ? launchAdvancedPlayer(mainPlayerUrl, logoPathForPlayer) : showCustomToast('Player não disponível.', 'info'));
    document.getElementById('modalFavoriteButton')?.addEventListener('click', () => toggleFavorite(details, mediaType));
    document.getElementById('modalCopyLinkButton')?.addEventListener('click', () => copyToClipboard(shareUrl));

    if (trailerKey) {
        document.getElementById('modalTrailerButton')?.addEventListener('click', () => {
            const trailerContainer = document.getElementById('trailer-container');
            if (trailerContainer) {
                if (trailerContainer.classList.contains('visible')) {
                    trailerContainer.classList.remove('visible');
                    setTimeout(() => {
                        trailerContainer.innerHTML = '';
                    }, 300);
                } else {
                    trailerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                    void trailerContainer.offsetWidth; 
                    trailerContainer.classList.add('visible');
                }
            }
        });
    }
}

let controlsHideTimer = null;
let zoomState = { level: 1, max: 3, x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let playerState = { currentFitMode: 'contain' };

function closeAdvancedPlayer() {
    const wrapper = document.getElementById('player-fullscreen-wrapper');
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.error(`Error attempting to exit fullscreen: ${err.message}`));
    }
    if (wrapper) {
        wrapper.style.display = 'none';
        wrapper.innerHTML = '';
        if(controlsHideTimer) clearTimeout(controlsHideTimer);
    }
}

function launchAdvancedPlayer(url, logoPath) {
    const wrapper = document.getElementById('player-fullscreen-wrapper');
    if (!wrapper) {
        showCustomToast('Erro Crítico: Componente do player ausente.', 'info');
        return;
    }

    zoomState = { level: 1, max: 3, x: 0, y: 0 };
    playerState.currentFitMode = 'contain';

    const logoForPlayerHTML = logoPath ? `<img src="${TMDB_IMAGE_BASE_URL}w300${logoPath}" id="player-logo" alt="logo">` : '';

    wrapper.innerHTML = `
        <iframe src="${url}" allowfullscreen sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>
        <button id="player-close-btn" title="Voltar"><i class="fas fa-arrow-left"></i></button>
        <div id="player-controls">
            ${logoForPlayerHTML}
            <div class="player-control-group">
                <button class="player-zoom-preset-btn active" data-zoom="1">100%</button>
                <button class="player-zoom-preset-btn" data-zoom="1.25">125%</button>
                <button class="player-zoom-preset-btn" data-zoom="1.5">150%</button>
                <button class="player-zoom-preset-btn" data-zoom="2">200%</button>
            </div>
            <div class="player-control-group">
                <button class="player-fit-btn" data-mode="contain" title="Conter"><i class="fas fa-compress-arrows-alt"></i></button>
                <button class="player-fit-btn" data-mode="cover" title="Preencher"><i class="fas fa-expand-arrows-alt"></i></button>
                <button class="player-fit-btn" data-mode="fill" title="Esticar"><i class="fas fa-expand"></i></button>
            </div>
        </div>
        <button id="show-controls-button"><i class="fas fa-eye"></i></button>`;

    wrapper.style.display = 'flex';
    setupPlayerEventListeners(wrapper);
    setPlayerFit(playerState.currentFitMode, false); 
    updatePlayerZoom();
    resetControlsTimer();
}

function setPlayerFit(fitMode, showToast = true) {
    const wrapper = document.getElementById('player-fullscreen-wrapper');
    const iframe = wrapper?.querySelector('iframe');
    if (!iframe) return;
    playerState.currentFitMode = fitMode;
    iframe.style.width = '';
    iframe.style.height = '';
    iframe.style.top = '';
    iframe.style.left = '';
    iframe.style.objectFit = 'initial';
    const containerWidth = wrapper.clientWidth;
    const containerHeight = wrapper.clientHeight;
    const containerRatio = containerWidth / containerHeight;
    const videoRatio = 16 / 9;
    if (fitMode === 'cover') {
        if (containerRatio > videoRatio) {
            const newHeight = containerWidth / videoRatio;
            iframe.style.height = `${newHeight}px`;
            iframe.style.top = `${(containerHeight - newHeight) / 2}px`;
        } else {
            const newWidth = containerHeight * videoRatio;
            iframe.style.width = `${newWidth}px`;
            iframe.style.left = `${(containerWidth - newWidth) / 2}px`;
        }
    } else if (fitMode === 'fill') {
        iframe.style.objectFit = 'fill';
    }
    updateFitButtonUI(fitMode);
    if (showToast) {
        const modeNames = { contain: 'Conter', cover: 'Preencher', fill: 'Esticar' };
        showCustomToast(`Modo: ${modeNames[fitMode]}`, 'info');
    }
    resetControlsTimer();
}

function updateFitButtonUI(activeMode) {
    document.querySelectorAll('.player-fit-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === activeMode));
}

function updatePlayerZoom() {
    const wrapper = document.getElementById('player-fullscreen-wrapper');
    const iframe = wrapper?.querySelector('iframe');
    if (!iframe) return;
    iframe.style.transform = `translate(${zoomState.x}px, ${zoomState.y}px) scale(${zoomState.level})`;
    wrapper.classList.toggle('zoomed', zoomState.level > 1);
}

function setupPlayerEventListeners(wrapper) {
    document.getElementById('player-close-btn')?.addEventListener('click', e => { e.stopPropagation(); closeAdvancedPlayer(); });
    document.querySelectorAll('.player-zoom-preset-btn').forEach(button => {
        button.addEventListener('click', e => {
            e.stopPropagation();
            zoomState.level = parseFloat(e.target.dataset.zoom);
            if (zoomState.level === 1) { zoomState.x = 0; zoomState.y = 0; }
            updatePlayerZoom();
            document.querySelectorAll('.player-zoom-preset-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            resetControlsTimer();
        });
    });
    document.querySelectorAll('.player-fit-btn').forEach(button => button.addEventListener('click', e => { e.stopPropagation(); setPlayerFit(button.dataset.mode); }));
    wrapper.addEventListener('mousedown', e => {
        if (e.target.closest('button, input')) return;
        if (zoomState.level > 1) {
            isPanning = true;
            panStart.x = e.clientX - zoomState.x;
            panStart.y = e.clientY - zoomState.y;
            wrapper.classList.add('grabbing');
        }
    });
    wrapper.addEventListener('mouseup', () => { isPanning = false; wrapper.classList.remove('grabbing'); });
    wrapper.addEventListener('mouseleave', () => { isPanning = false; wrapper.classList.remove('grabbing'); });
    wrapper.addEventListener('mousemove', e => {
        resetControlsTimer();
        if (isPanning) {
            zoomState.x = e.clientX - panStart.x;
            zoomState.y = e.clientY - panStart.y;
            updatePlayerZoom();
        }
    });
    wrapper.querySelector('#show-controls-button')?.addEventListener('click', e => {
        e.stopPropagation();
        wrapper.querySelector('#player-controls')?.classList.remove('hidden');
        wrapper.querySelector('#show-controls-button')?.classList.remove('visible');
        resetControlsTimer();
    });
}

function resetControlsTimer() {
    clearTimeout(controlsHideTimer);
    const controls = document.getElementById('player-controls');
    const showControlsBtn = document.getElementById('show-controls-button');
    const closeBtn = document.getElementById('player-close-btn');
    if(controls) controls.classList.remove('hidden');
    if(showControlsBtn) showControlsBtn.classList.remove('visible');
    if(closeBtn) closeBtn.style.opacity = '1';
    controlsHideTimer = setTimeout(() => {
        if(controls) controls.classList.add('hidden');
        if(showControlsBtn) showControlsBtn.classList.add('visible');
        if(closeBtn) closeBtn.style.opacity = '0';
    }, 4000);
}

async function openFilterSweetAlert() {
    const swalHTML = `<div class="swal-genre-filter-type-selector mb-4"><button id="swalMovieGenreTypeButton" data-type="movie" class="${currentFilterTypeSA === 'movie' ? 'active' : ''}">Filmes</button><button id="swalTvGenreTypeButton" data-type="tv" class="${currentFilterTypeSA === 'tv' ? 'active' : ''}">Séries</button><button id="swalAnimeGenreTypeButton" data-type="anime" class="${currentFilterTypeSA === 'anime' ? 'active' : ''}">Animes</button></div><div id="swalGenreButtonsPanel" class="swal-genre-buttons-panel my-4">Carregando...</div>`;
    Swal.fire({
        title: 'Filtrar por Gênero', html: swalHTML, showCloseButton: true, showDenyButton: true,
        denyButtonText: 'Limpar Filtro', confirmButtonText: 'Aplicar Filtro',
        customClass: { popup: 'swal2-popup' },
        didOpen: () => {
            const genrePanel = document.getElementById('swalGenreButtonsPanel');
            document.getElementById('swalMovieGenreTypeButton')?.addEventListener('click', () => fetchAndDisplayGenresInSA('movie', genrePanel));
            document.getElementById('swalTvGenreTypeButton')?.addEventListener('click', () => fetchAndDisplayGenresInSA('tv', genrePanel));
            document.getElementById('swalAnimeGenreTypeButton')?.addEventListener('click', () => fetchAndDisplayGenresInSA('anime', genrePanel));
            fetchAndDisplayGenresInSA(currentFilterTypeSA, genrePanel);
        },
        preConfirm: () => selectedGenreSA,
    }).then(async (result) => {
        if (result.isConfirmed) applyGenreFilterFromSA();
        else if (result.isDenied) {
            selectedGenreSA = { id: null, name: null, type: null };
            activeAppliedGenre = { id: null, name: null, type: null };
            if (filterToggleButton) filterToggleButton.classList.remove('active');
            loadMainPageContent();
        }
    });
}

async function fetchAndDisplayGenresInSA(mediaType, genrePanelElement) {
    if (!genrePanelElement) return;
    currentFilterTypeSA = mediaType;
    document.querySelectorAll('.swal-genre-filter-type-selector button').forEach(btn => btn.classList.toggle('active', btn.dataset.type === mediaType));
    genrePanelElement.innerHTML = '<div class="loader mx-auto my-3"></div>';
    const genresToFetchType = mediaType === 'anime' ? 'tv' : mediaType;
    const data = await fetchTMDB(`/genre/${genresToFetchType}/list`);
    genrePanelElement.innerHTML = '';
    if (data && !data.error && data.genres) {
        if (mediaType === 'anime') {
            const allBtn = document.createElement('button');
            allBtn.textContent = 'Todos os Animes'; allBtn.dataset.genreId = '';
            allBtn.onclick = () => { selectedGenreSA = { id: null, name: 'Todos', type: 'anime' }; updateGenreButtonsInSAUI(genrePanelElement); };
            genrePanelElement.appendChild(allBtn);
        }
        data.genres.forEach(genre => {
            const button = document.createElement('button');
            button.textContent = genre.name; button.dataset.genreId = genre.id;
            button.onclick = () => { selectedGenreSA = { id: genre.id, name: genre.name, type: mediaType }; updateGenreButtonsInSAUI(genrePanelElement); };
            genrePanelElement.appendChild(button);
        });
        updateGenreButtonsInSAUI(genrePanelElement);
    } else {
        genrePanelElement.innerHTML = `<p class="text-xs text-center">Géneros não encontrados.</p>`;
    }
}

function updateGenreButtonsInSAUI(panel) {
    if (!panel) return;
    panel.querySelectorAll('button').forEach(btn => {
        const btnId = btn.dataset.genreId ? parseInt(btn.dataset.genreId, 10) : null;
        const isActive = (selectedGenreSA.id === null && btnId === null && selectedGenreSA.type === 'anime') || (btnId === selectedGenreSA.id);
        btn.classList.toggle('active', isActive);
    });
}

async function loadMoreItems() {
    if (isLoadingMore) return;
    isLoadingMore = true;
    if (searchResultsLoader) searchResultsLoader.style.display = 'block';
    let nextPageData = null;
    try {
        if (currentContentContext === 'search' && searchCurrentPage < totalPages.search) {
            searchCurrentPage++;
            nextPageData = await fetchTMDB('/search/multi', { query: searchInput.value, page: searchCurrentPage });
            if (nextPageData && !nextPageData.error && nextPageData.results) {
                totalPages.search = nextPageData.total_pages || totalPages.search;
                displayResults(nextPageData.results.filter(item => item.poster_path), null, singleResultsGrid, false);
            } else { searchCurrentPage--; }
        } else if (currentContentContext === 'filter' && filterCurrentPage < totalPages.filter) {
            filterCurrentPage++;
            const endpointType = activeAppliedGenre.type === 'movie' ? 'movie' : 'tv';
            let params = { sort_by: 'popularity.desc', page: filterCurrentPage };
            if (activeAppliedGenre.id) params.with_genres = activeAppliedGenre.id;
            if (activeAppliedGenre.type === 'anime') {
                params.with_origin_country = TMDB_JAPAN_COUNTRY_CODE;
                params.with_keywords = TMDB_ANIME_KEYWORD_ID;
            }
            nextPageData = await fetchTMDB(`/discover/${endpointType}`, params);
            if (nextPageData && !nextPageData.error && nextPageData.results) {
                totalPages.filter = nextPageData.total_pages || totalPages.filter;
                displayResults(nextPageData.results, activeAppliedGenre.type, singleResultsGrid, false);
            } else { filterCurrentPage--; }
        }
    } catch (error) {
        console.error("Erro ao carregar mais itens:", error);
    } finally {
        if (searchResultsLoader) searchResultsLoader.style.display = 'none';
        isLoadingMore = false;
    }
}

function showCustomToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `custom-toast custom-toast--${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 2500);
}

function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[array[i], array[j]] = [array[j], array[i]]; } }
function showLoader() { if (loader) loader.style.display = 'flex'; }
function hideLoader() { if (loader) loader.style.display = 'none'; }
function updatePageBackground(path) { if (pageBackdrop) pageBackdrop.style.backgroundImage = path ? `url(${TMDB_IMAGE_BASE_URL}w1280${path})` : ''; }
function getFavorites() { try { return JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]'); } catch { return []; } }
function saveFavorites(favs) { localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favs)); }
function isFavorite(id, type) { return favorites.some(fav => fav.id.toString() === id.toString() && fav.media_type === type); }

function toggleFavorite(item, type) {
    const itemId = item.id.toString();
    const index = favorites.findIndex(fav => fav.id.toString() === itemId && fav.media_type === type);
    if (index > -1) { favorites.splice(index, 1); showCustomToast('Removido dos Favoritos', 'info');
    } else { favorites.push({ id: item.id, media_type: type, title: item.title || item.name, poster_path: item.poster_path, backdrop_path: item.backdrop_path }); showCustomToast('Adicionado aos Favoritos', 'success'); }
    saveFavorites(favorites);
    updateFavoriteButtonsState(item.id, type);
}

function updateFavoriteButtonsState(id, type) {
    const isFav = isFavorite(id, type);
    document.querySelectorAll(`.favorite-button[data-id="${id}"][data-type="${type}"]`).forEach(btn => {
        btn.classList.toggle('active', isFav);
        btn.innerHTML = isFav ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
    });
    const modalBtn = document.getElementById('modalFavoriteButton');
    if (modalBtn && modalBtn.dataset.id == id && modalBtn.dataset.type == type) {
        modalBtn.classList.toggle('active', isFav);
        modalBtn.title = isFav ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos';
        modalBtn.innerHTML = isFav ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
    }
}

function displayResults(items, defaultType, targetEl, replace) {
    if (!targetEl) return;
    if (replace) targetEl.innerHTML = '';
    const fragment = document.createDocumentFragment();
    if (!items || items.length === 0) { if (replace) targetEl.innerHTML = `<p class="col-span-full text-center">Nenhum item para exibir.</p>`; return; }
    
    const placeholderSrc = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    items.forEach(item => {
        const mediaType = item.media_type || defaultType;
        if (!mediaType || !item.poster_path) return;
        
        const card = document.createElement('div'); 
        card.className = 'content-card';
        card.onclick = () => openItemModal(item.id, mediaType, item.backdrop_path);
        
        const isFav = isFavorite(item.id, mediaType);
        const imageUrl = `${TMDB_IMAGE_BASE_URL}w400${item.poster_path}`;

        card.innerHTML = `
            <img src="${placeholderSrc}" data-src="${imageUrl}" alt="${item.title||item.name}" class="lazy-image">
            <div class="title-overlay"><div class="title">${item.title||item.name}</div></div>
            <button class="favorite-button ${isFav ? 'active' : ''}" data-id="${item.id}" data-type="${mediaType}">
                <i class="${isFav ? 'fas fa-heart' : 'far fa-heart'}"></i>
            </button>`;
            
        card.querySelector('.favorite-button').onclick = (e) => { e.stopPropagation(); toggleFavorite(item, mediaType); };
        fragment.appendChild(card);
    });
    
    targetEl.appendChild(fragment);
    observeNewImages(targetEl);
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showCustomToast('Link copiado!', 'success');
        }).catch(() => {
            showCustomToast('Erro ao copiar.', 'info');
        });
    } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showCustomToast('Link copiado!', 'success');
        } catch (err) {
            showCustomToast('Erro ao copiar.', 'info');
        } finally {
            document.body.removeChild(textArea);
        }
    }
}

async function openFavoritesModal() {
    let favsHtml = '<p class="text-center text-gray-400 py-5">Você não tem favoritos.</p>';
    const placeholderSrc = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    if (favorites.length > 0) {
        favsHtml = `<div class="favorites-grid">${favorites.map(item => `
            <div class="content-card favorite-card" onclick="Swal.close(); openItemModal(${item.id}, '${item.media_type}', '${item.backdrop_path || ''}')">
                <img src="${placeholderSrc}" data-src="${TMDB_IMAGE_BASE_URL}w342${item.poster_path}" alt="${item.title || ''}" class="lazy-image">
                <div class="title-overlay"><div class="title">${item.title || ''}</div></div>
                <button class="remove-favorite-button" data-id="${item.id}" data-type="${item.media_type}"><i class="fas fa-times-circle"></i></button>
            </div>`).join('')}</div>`;
    }
    Swal.fire({
        title: 'Meus Favoritos', html: favsHtml, showConfirmButton: false, showCloseButton: true,
        customClass: { popup: 'swal-favorites-popup' },
        didOpen: (modal) => {
            observeNewImages(modal);
            document.querySelectorAll('.remove-favorite-button').forEach(button => {
                button.addEventListener('click', e => {
                    e.stopPropagation();
                    const itemToRemove = favorites.find(fav => fav.id.toString() === button.dataset.id && fav.media_type === button.dataset.type);
                    if (itemToRemove) {
                        toggleFavorite(itemToRemove, itemToRemove.media_type);
                        const card = button.closest('.favorite-card');
                        card.style.transition = 'opacity 0.3s';
                        card.style.opacity = '0';
                        setTimeout(() => card.remove(), 300);
                    }
                });
            });
        }
    });
}

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyIsValid = typeof TMDB_API_KEY !== 'undefined' && TMDB_API_KEY.length > 10;
    if (!apiKeyIsValid) {
        document.body.innerHTML = `<div style="color:red;padding:2rem;text-align:center;">Erro: Chave da API não configurada.</div>`;
        return;
    }

    setupLazyLoader();

    favorites = getFavorites();
    if (searchInput) searchInput.addEventListener('input', debounce(() => performSearch(searchInput.value), 500));
    if (searchButton) searchButton.addEventListener('click', () => performSearch(searchInput.value));
    if (filterToggleButton) filterToggleButton.addEventListener('click', openFilterSweetAlert);
    if (floatingFavoritesButton) floatingFavoritesButton.addEventListener('click', openFavoritesModal);

    if (openCalendarBtn) openCalendarBtn.addEventListener('click', (e) => { e.stopPropagation(); document.body.classList.add('calendar-open'); });
    if (closeCalendarBtn) closeCalendarBtn.addEventListener('click', () => document.body.classList.remove('calendar-open'));
    
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.addEventListener('click', () => { if (document.body.classList.contains('calendar-open')) document.body.classList.remove('calendar-open'); });

    const debouncedLoadMoreMovies = debounce(loadMorePopularMovies, 300);
    const debouncedLoadMoreShows = debounce(loadMoreTopRatedTvShows, 300);
    const debouncedLoadMoreItems = debounce(loadMoreItems, 300);

    if(moviesResultsGrid) moviesResultsGrid.addEventListener('scroll', () => {
        if (defaultContentSections?.style.display === 'block' && !isLoadingMorePopularMovies && popularMoviesCurrentPage < popularMoviesTotalPages && (moviesResultsGrid.scrollLeft + moviesResultsGrid.clientWidth >= moviesResultsGrid.scrollWidth - 200)) {
            debouncedLoadMoreMovies();
        }
    });

    if(tvShowsResultsGrid) tvShowsResultsGrid.addEventListener('scroll', () => {
        if (defaultContentSections?.style.display === 'block' && !isLoadingMoreTopRatedTvShows && topRatedTvShowsCurrentPage < topRatedTvShowsTotalPages && (tvShowsResultsGrid.scrollLeft + tvShowsResultsGrid.clientWidth >= tvShowsResultsGrid.scrollWidth - 200)) {
            debouncedLoadMoreShows();
        }
    });

    const scrollTargetForResults = window.innerWidth < 768 ? document.getElementById('contentArea') : window;
    scrollTargetForResults?.addEventListener('scroll', () => {
        const isSingleSectionVisible = singleResultsSection?.style.display === 'block';
        if (!isSingleSectionVisible || isLoadingMore) return;
        const offset = 200;
        let scrolledToEnd = false;
        if (scrollTargetForResults === window) {
            scrolledToEnd = (window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - offset;
        } else {
            scrolledToEnd = (scrollTargetForResults.scrollTop + scrollTargetForResults.clientHeight) >= scrollTargetForResults.scrollHeight - offset;
        }
        if(scrolledToEnd) debouncedLoadMoreItems();
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            const wrapper = document.getElementById('player-fullscreen-wrapper');
            if (wrapper && wrapper.style.display !== 'none') {
                closeAdvancedPlayer();
            }
        }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type');
    const idParam = urlParams.get('id');
    if (typeParam && idParam) openItemModal(idParam, typeParam);
    else loadMainPageContent();
});
