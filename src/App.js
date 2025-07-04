import React, { useState, useEffect } from 'react';
import './App.css';
import './Sidebar.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const HOME_PAGE = 'Catalogo1/index.html';

  const [iframeSrc, setIframeSrc] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paginaParaCarregar = urlParams.get('pagina');
    return paginaParaCarregar ? decodeURIComponent(paginaParaCarregar) : HOME_PAGE;
  });
  const [iframeHistory, setIframeHistory] = useState([iframeSrc]);

  useEffect(() => {
    // Simulate content loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000); // Adjust as needed

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadThemeCss = () => {
      const selectedTheme = localStorage.getItem('selectedTheme') || 'default';
      const cssFiles = [
        'sidebar.css',
        'ocultos.css',
        'integration.css',
        'catálogo.css',
        'update.css',
        'sorteio.css',
        'calendario.css'
      ];

      document.querySelectorAll('link[data-theme-css]').forEach(link => link.remove());

      cssFiles.forEach(file => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `themes/${selectedTheme}/${file}`;
        link.setAttribute('data-theme-css', '');
        document.head.appendChild(link);
      });
    };

    loadThemeCss();
  }, []);

  const handleThemeChange = (theme) => {
    localStorage.setItem('selectedTheme', theme);
    window.location.reload();
  };

  const iframeRef = useRef(null);

  const handleIframeLoad = () => {
    setIsLoading(false);
    if (iframeRef.current) {
      setupIframeContentListeners();
      setupIframeLinks();
    }
  };

  const setupIframeLinks = () => {
    try {
      const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
      iframeDoc.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (link && link.href && !link.target && !link.href.startsWith('javascript:')) {
          event.preventDefault();
          const href = link.href;
          setIframeHistory(prevHistory => [...prevHistory, href]);
          setIframeSrc(href);
        }
      });
    } catch (e) {
      console.warn("Erro ao configurar links da iframe:", e);
    }
  };

  const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), delay);
    };
  };

  const setupIframeContentListeners = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const handleFrameInteraction = () => {
        // Assuming sidebar state is managed by isSidebarExpanded
        if (isSidebarExpanded) {
          setIsSidebarExpanded(false);
        }
      };

      iframeRef.current.contentWindow.addEventListener('scroll', debounce(handleFrameInteraction, 200));
      iframeRef.current.contentWindow.addEventListener('click', handleFrameInteraction);
      iframeRef.current.contentWindow.addEventListener('touchstart', handleFrameInteraction, { passive: true });
    }
  };

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const handleSidebarToggle = () => {
    setIsSidebarExpanded(prev => !prev);
  };

  useEffect(() => {
    const sidebarButtonsContainer = document.querySelector('.sidebar-buttons');

    const handleClickOutside = (event) => {
      if (sidebarButtonsContainer && !sidebarButtonsContainer.contains(event.target) && isSidebarExpanded) {
        setIsSidebarExpanded(false);
      }
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isSidebarExpanded]);

  const HOME_PAGE = 'Catalogo1/index.html';

  const handleIframeBack = () => {
    if (iframeHistory.length > 1) {
      const newHistory = iframeHistory.slice(0, iframeHistory.length - 1);
      const previous = newHistory[newHistory.length - 1];
      setIframeSrc(previous);
      setIframeHistory(newHistory);
    } else {
      setIframeSrc(HOME_PAGE);
      setIframeHistory([HOME_PAGE]);
    }
  };

  const handleFullscreenToggle = () => {
    const docEl = document.documentElement;

    if (!document.fullscreenElement) {
      if (docEl.requestFullscreen) docEl.requestFullscreen();
      else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
      else if (docEl.msRequestFullscreen) docEl.msRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) docEl.webkitExitFullscreen();
      else if (document.msExitFullscreen) docEl.msExitFullscreen();
    }
  };

  useEffect(() => {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const icon = fullscreenBtn ? fullscreenBtn.querySelector('i') : null;

    const handleFullscreenChange = () => {
      if (!icon) return;

      if (document.fullscreenElement) {
        icon.classList.remove('fa-expand');
        icon.classList.add('fa-compress');
      } else {
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const checkScreen = () => {
      const fullscreenBtn = document.getElementById('fullscreenBtn');
      if (fullscreenBtn) {
        if (window.innerWidth > 768) {
          fullscreenBtn.style.display = 'flex';
        } else {
          fullscreenBtn.style.display = 'none';
        }
      }
    };

    window.addEventListener('resize', checkScreen);
    checkScreen();

    return () => {
      window.removeEventListener('resize', checkScreen);
    };
  }, []);

  useEffect(() => {
    const handlePopstate = (event) => {
      if (event.state && event.state.iframe) {
        setIframeSrc(event.state.iframe);
        setIframeHistory(prevHistory => {
          const newHistory = [...prevHistory];
          while (newHistory.length > 0 && newHistory[newHistory.length - 1] !== event.state.iframe) {
            newHistory.pop();
          }
          return newHistory;
        });
      }
    };

    window.addEventListener('popstate', handlePopstate);

    return () => {
      window.removeEventListener('popstate', handlePopstate);
    };
  }, []);

  useEffect(() => {
    history.replaceState({ iframe: iframeSrc }, '', '');
  }, [iframeSrc]);

  useEffect(() => {
    const newsFrame = document.getElementById('newsFrame');
    if (newsFrame) {
      newsFrame.addEventListener('load', () => {
        setIsLoading(false);
      });
    }
  }, []);

  useEffect(() => {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
      const handleMouseEnter = () => {
        fullscreenBtn.style.background = 'rgba(255,255,255,0.1)';
      };
      const handleMouseLeave = () => {
        fullscreenBtn.style.background = 'rgba(0,0,0,0.4)';
      };

      fullscreenBtn.addEventListener('mouseenter', handleMouseEnter);
      fullscreenBtn.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        fullscreenBtn.removeEventListener('mouseenter', handleMouseEnter);
        fullscreenBtn.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, []);

  return (
    <div className="App">
      {/* Loader Overlay */}
      {isLoading && (
        <div id="loader-overlay">
          <div className="loader-spinner"></div>
        </div>
      )}

      {/* Main Iframe (will be replaced by React Router) */}
      <iframe id="newsFrame" ref={iframeRef} src={iframeSrc} title="Início" onLoad={handleIframeLoad}></iframe>

      {/* Sidebar Buttons */}
      <div className={`sidebar-buttons ${!isSidebarExpanded ? 'sidebar-container-condensed' : ''}`}>
        <a href="#" className="icon-button" id="sidebarToggleBtn" title="Mostrar Menu" onClick={handleSidebarToggle}>
          <i className={`fas ${isSidebarExpanded ? 'fa-times' : 'fa-bars'}`}></i>
        </a>
        <a href="#" className="icon-button" id="iframeBackButton" title="Voltar" style={{ display: iframeHistory.length > 1 ? 'flex' : 'none' }} onClick={handleIframeBack}>
          <i className="fas fa-arrow-left"></i>
        </a>
        <a href="https://feed-pearl.vercel.app/" className="icon-button" title="Notícias" style={{ display: isSidebarExpanded ? 'flex' : 'none' }}>
          <i className="fas fa-newspaper"></i>
        </a>
        <a href="./sorteio/index.html" className="icon-button" title="Sorteio" style={{ display: isSidebarExpanded ? 'flex' : 'none' }} onClick={(e) => { e.preventDefault(); setIframeSrc('./sorteio/index.html'); setIframeHistory([...iframeHistory, './sorteio/index.html']); }}>
          <i className="fa-solid fa-cube"></i>
        </a>
        <a href="#" className="icon-button" id="openThemeModalBtn" title="Selecionar Tema" style={{ display: isSidebarExpanded ? 'flex' : 'none' }} onClick={() => setShowThemeModal(true)}>
          <i className="fas fa-palette"></i>
        </a>
        <a href="./update/index.html" className="icon-button" title="Atualizações" style={{ display: isSidebarExpanded ? 'flex' : 'none' }} onClick={(e) => { e.preventDefault(); setIframeSrc('./update/index.html'); setIframeHistory([...iframeHistory, './update/index.html']); }}>
          <i className="fa-solid fa-circle-down"></i>
        </a>
      </div>
      
      {/* Fullscreen Button for Desktop */}
      <button id="fullscreenBtn" className="fullscreen-toggle" title="Tela cheia" onClick={handleFullscreenToggle}>
        <i className="fas fa-expand"></i>
      </button>

      {/* Theme Selection Modal */}
      {showThemeModal && (
        <div id="themeSelectionModal" className="theme-modal-overlay" onClick={() => setShowThemeModal(false)}>
          <div className="theme-modal-content" onClick={(e) => e.stopPropagation()}>
            <span className="theme-modal-close" onClick={() => setShowThemeModal(false)}>&times;</span>
            <h2>Escolha seu Tema</h2>
            <div className="theme-modal-buttons">
              <button className="theme-modal-button default" data-theme="default" onClick={() => handleThemeChange('default')}>Padrão</button>
              <button className="theme-modal-button dracula" data-theme="dracula" onClick={() => handleThemeChange('dracula')}>Dracula</button>
              <button className="theme-modal-button anime" data-theme="anime" onClick={() => handleThemeChange('anime')}>Anime</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;