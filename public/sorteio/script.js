// Referências dos elementos HTML
const randomMovieButton = document.getElementById('randomMovieButton');
const randomTvButton = document.getElementById('randomTvButton');
const historyButton = document.getElementById('historyButton');
const pickAgainButton = document.getElementById('pickAgainButton');

// Variáveis de estado
let pickedMediaHistory = [];
const MAX_HISTORY_SIZE = 40;
let lastPickedMediaType = null;

/**
 * Salva o histórico de mídias sorteadas no LocalStorage.
 */
function saveHistoryToLocalStorage() {
    try {
        localStorage.setItem('pickedMediaHistory_v2', JSON.stringify(pickedMediaHistory));
    } catch (e) {
        console.error('Erro ao salvar histórico:', e);
    }
}

/**
 * Carrega o histórico de mídias sorteadas do LocalStorage ao iniciar.
 */
function loadHistoryFromLocalStorage() {
    try {
        const stored = localStorage.getItem('pickedMediaHistory_v2');
        if (stored) {
            // Garante que o histórico carregado não exceda o tamanho máximo
            pickedMediaHistory = JSON.parse(stored).slice(-MAX_HISTORY_SIZE);
        }
    } catch (e) {
        console.error('Erro ao carregar histórico:', e);
        // Limpa o histórico corrompido para evitar erros futuros
        localStorage.removeItem('pickedMediaHistory_v2');
        pickedMediaHistory = [];
    }
}

/**
 * Verifica se um item já está no histórico.
 * @param {object} item - O objeto de mídia do TMDB.
 * @returns {boolean} - True se o item estiver no histórico.
 */
function isItemInHistory(item) {
    // Adiciona o tipo ao item para verificação, caso não exista
    const itemType = item.media_type || lastPickedMediaType;
    return pickedMediaHistory.some(h => h.id === item.id && h.type === itemType);
}

/**
 * Adiciona um item sorteado ao histórico.
 * @param {object} item - O objeto de mídia do TMDB.
 */
function addToHistory(item) {
    const historyItem = {
        id: item.id,
        type: item.media_type || lastPickedMediaType,
        title: item.title || item.name || 'Título Desconhecido',
        backdrop_path: item.backdrop_path,
        timestamp: new Date().toISOString()
    };
    
    // Remove o item se já existir para adicioná-lo no final (mais recente)
    pickedMediaHistory = pickedMediaHistory.filter(h => h.id !== historyItem.id || h.type !== historyItem.type);
    pickedMediaHistory.push(historyItem);

    // Mantém o histórico dentro do limite de tamanho
    if (pickedMediaHistory.length > MAX_HISTORY_SIZE) {
        pickedMediaHistory.shift();
    }
    saveHistoryToLocalStorage();
}

/**
 * Sorteia uma mídia (filme ou série) aleatoriamente usando a API do TMDB.
 * @param {string} type - 'movie' ou 'tv'.
 */
async function pickRandomMedia(type) {
    // Verifica se as funções essenciais do catálogo foram carregadas
    if (typeof showLoader !== 'function' || typeof fetchTMDB !== 'function' || typeof openItemModal !== 'function') {
        Swal.fire({ icon: 'error', title: 'Erro de Carregamento', text: 'Os scripts do catálogo não foram carregados corretamente. Verifique os caminhos no HTML.' });
        return;
    }
    
    lastPickedMediaType = type;
    showLoader();

    try {
        const endpoint = type === 'movie' ? '/discover/movie' : '/discover/tv';
        // Limita a busca às primeiras 200 páginas para aumentar a chance de encontrar conteúdo relevante
        const totalPagesToConsider = 200; 
        let randomItem = null;
        let attempts = 0;
        const MAX_ATTEMPTS = 15; // Número de tentativas para encontrar um item não visto

        while (!randomItem && attempts < MAX_ATTEMPTS) {
            const randomPage = Math.floor(Math.random() * totalPagesToConsider) + 1;
            // Filtros para obter resultados mais relevantes e evitar reality shows, etc.
            const params = { 
                page: randomPage,
                "vote_count.gte": 100, // Itens com um número mínimo de votos
                "sort_by": "popularity.desc"
            };
            if (type === 'tv') {
                params.without_genres = '10764,10767'; // Exclui talk shows e reality shows
            }

            const data = await fetchTMDB(endpoint, params);

            if (data && data.results?.length > 0) {
                // Filtra itens que não estão no histórico e que possuem uma sinopse
                const availableItems = data.results.filter(i => !isItemInHistory(i) && i.overview);
                if (availableItems.length > 0) {
                    // Seleciona um item aleatório da lista de disponíveis
                    randomItem = availableItems[Math.floor(Math.random() * availableItems.length)];
                }
            }
            attempts++;
        }

        if (randomItem) {
            addToHistory(randomItem);
            // Chama o modal do script do catálogo, passando as informações necessárias
            openItemModal(randomItem.id, type, randomItem.backdrop_path);
        } else {
            Swal.fire({ 
                icon: 'warning', 
                title: 'Nenhum item novo encontrado!', 
                text: `Não foi possível sortear um(a) ${type === 'movie' ? 'filme' : 'série'} novo(a) no momento. Tente novamente.` 
            });
        }
    } catch (error) {
        console.error('Erro ao sortear mídia:', error);
        Swal.fire({ icon: 'error', title: 'Erro de Conexão', text: 'Não foi possível se comunicar com a API.' });
    } finally {
        hideLoader();
    }
}

/**
 * Exibe o histórico de mídias sorteadas em um modal.
 */
function showHistoryModal() {
    if (pickedMediaHistory.length === 0) {
        Swal.fire({ title: 'Histórico', text: 'Você ainda não sorteou nenhuma mídia.', showCloseButton: true, showConfirmButton: false });
        return;
    }
    // Ordena o histórico do mais recente para o mais antigo
    const sorted = [...pickedMediaHistory].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Cria o HTML para a lista do histórico dentro de um contêiner rolável
    let html = '<div style="max-height: 300px; overflow-y: auto; padding-right: 10px;"><ul style="list-style: none; padding: 0; text-align: left;">';
    sorted.forEach(i => {
        html += `<li style="padding: 10px; border-bottom: 1px solid #333;" onclick="Swal.close(); openItemModal(${i.id}, '${i.type}', '${i.backdrop_path}')">
                    <strong>${i.title}</strong> (${i.type === 'movie' ? 'Filme' : 'Série'})<br>
                    <small style="color: #9CA3AF;">${new Date(i.timestamp).toLocaleString('pt-BR')}</small>
                 </li>`;
    });
    html += '</ul></div>';

    Swal.fire({ 
        title: 'Histórico', 
        html, 
        showCloseButton: true, 
        showConfirmButton: false,
        width: '850px',
        maxWidth: '95vw',
        maxHeight: '90vh',
        customClass: {
            popup: 'swal-history-popup',
            htmlContainer: 'swal2-html-container-history'
        }
    });
}

// --- Event Listeners ---
randomMovieButton.addEventListener('click', () => pickRandomMedia('movie'));
randomTvButton.addEventListener('click', () => pickRandomMedia('tv'));
historyButton.addEventListener('click', showHistoryModal);

pickAgainButton.addEventListener('click', () => {
    // Fecha o modal atual antes de sortear o próximo
    if (Swal.isVisible()) {
        Swal.close();
        // Um pequeno delay para a animação de fechar do modal terminar
        setTimeout(() => {
            if (lastPickedMediaType) {
                pickRandomMedia(lastPickedMediaType);
            }
        }, 250); 
    } else {
         if (lastPickedMediaType) {
            pickRandomMedia(lastPickedMediaType);
        }
    }
});

// Carrega o histórico quando a página é carregada
document.addEventListener('DOMContentLoaded', loadHistoryFromLocalStorage);
