// Global variable to store the active chat ID
let selectedChatId = null;
// Variable global para controlar la operación en curso
let isProcessingChatSelect = false;

// ⚡ NUEVAS VARIABLES PARA INFINITE SCROLL
let currentPage = 0;
let isLoadingMore = false;
let hasMoreChats = true;
const CHATS_PER_PAGE = 50;
let allLoadedChats = []; // Cache de todos los chats cargados

// Función para manejar errores de autenticación
function handleAuthError(error) {
    console.error('Error de autenticación:', error);
    
    // Si es un error de token/autorización, redirigir al login
    if (error.message && (
        error.message.includes('token') || 
        error.message.includes('autorización') ||
        error.message.includes('autenticación')
    )) {
        // Limpiar almacenamiento y mostrar mensaje
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('selectedChatId');
        
        // Mostrar mensaje y redirigir
        alert('Sesión expirada o inválida. Por favor, inicie sesión nuevamente.');
        window.location.href = '/';
    }
}

// ⚡ FUNCIÓN ACTUALIZADA - Function to load chats con paginación
async function loadChats(append = false) {
    try {
        // Si ya estamos cargando, no hacer nada
        if (isLoadingMore) return;
        
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No se encontró el token de autenticación');
        }

        // Si no es append, reiniciar
        if (!append) {
            currentPage = 0;
            allLoadedChats = [];
            hasMoreChats = true;
        }

        isLoadingMore = true;

        const skip = currentPage * CHATS_PER_PAGE;
        const response = await fetch(`/api/chats?limit=${CHATS_PER_PAGE}&skip=${skip}`, {
            method: 'GET',
            headers: {
                'x-auth-token': token
            }
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.msg || 'Error al cargar los chats');
        }

        const chats = await response.json();

        // Agregar o reemplazar chats
        if (append) {
            allLoadedChats = [...allLoadedChats, ...chats];
        } else {
            allLoadedChats = chats;
        }

        // Si devolvió menos chats que el límite, no hay más
        hasMoreChats = chats.length === CHATS_PER_PAGE;
        currentPage++;

        displayChats(allLoadedChats, append);

        // Restore selected chat if exists
        const savedChatId = localStorage.getItem('selectedChatId');
        if (savedChatId && !append) {
            const chatElement = document.querySelector(`.chat-item[data-id="${savedChatId}"]`);
            if (chatElement && !isProcessingChatSelect) {
                chatElement.click();
            }
        }

        console.log(`Chats cargados: ${allLoadedChats.length} (hasMore: ${hasMoreChats})`);

    } catch (error) {
        handleAuthError(error);
        console.error('Error:', error);
    } finally {
        isLoadingMore = false;
    }
}

// ⚡ FUNCIÓN ACTUALIZADA - Function to display chats con indicador de carga
function displayChats(chats, append = false) {
    const chatsContainer = document.getElementById('chats-container');
    
    // Si no es append, limpiar el contenedor
    if (!append) {
        chatsContainer.innerHTML = '';
    } else {
        // Remover el indicador de carga si existe
        const loadingIndicator = chatsContainer.querySelector('.loading-more-trigger');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }

    if (chats.length === 0 && !append) {
        chatsContainer.innerHTML = '<div class="empty-chats">No hay chats disponibles</div>';
        return;
    }

    // Si es append, solo renderizar los nuevos
    const startIndex = append ? chats.length - CHATS_PER_PAGE : 0;
    const chatsToRender = chats.slice(Math.max(0, startIndex));

    chatsToRender.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.classList.add('chat-item');
        chatItem.setAttribute('data-id', chat.chatId);

        // Si este es el chat seleccionado actualmente, marcarlo como activo
        let showUnreadCount = chat.unreadCount > 0;
        
        if (selectedChatId === chat.chatId) {
            chatItem.classList.add('active');
            showUnreadCount = false;
        }

        const lastMessageDate = new Date(chat.lastMessageTimestamp);
        const timeString = formatTime(lastMessageDate);

        chatItem.innerHTML = `
            <div class="chat-info">
                <div class="chat-name">${chat.contactName || chat.phoneNumber}</div>
                <div class="chat-preview">${chat.lastMessage}</div>
            </div>
            <div class="chat-meta">
                <div class="chat-time">${timeString}</div>
                ${showUnreadCount ? `<div class="unread-count">${chat.unreadCount}</div>` : ''}
            </div>
        `;

        chatItem.addEventListener('click', () => selectChat(chat.chatId));
        chatsContainer.appendChild(chatItem);
    });

    // ⚡ AGREGAR INDICADOR DE CARGA SI HAY MÁS CHATS
    if (hasMoreChats && !isLoadingMore) {
        const loadingTrigger = document.createElement('div');
        loadingTrigger.classList.add('loading-more-trigger');
        loadingTrigger.style.height = '50px';
        loadingTrigger.style.display = 'flex';
        loadingTrigger.style.alignItems = 'center';
        loadingTrigger.style.justifyContent = 'center';
        loadingTrigger.innerHTML = '<div style="color: #888; font-size: 14px;">Cargando más chats...</div>';
        chatsContainer.appendChild(loadingTrigger);
    }
}

// Function to select a chat and load its messages
function selectChat(chatId) {
    // Evitar múltiples selecciones simultáneas
    if (isProcessingChatSelect) return;
    isProcessingChatSelect = true;

    try {
        console.log(`Seleccionando chat: ${chatId}`);
        
        // IMPORTANTE: Limpiar el estado del chat anterior
        if (window.clearChatState && typeof window.clearChatState === 'function') {
            console.log('Limpiando estado del chat anterior');
            window.clearChatState();
        } else {
            console.warn('La función clearChatState no está disponible');
        }
        
        // Detener cualquier temporizador activo
        if (window.chatRefreshInterval) {
            clearInterval(window.chatRefreshInterval);
        }

        // Update UI to show selected chat
        const chatItems = document.querySelectorAll('.chat-item');
        chatItems.forEach(item => {
            item.classList.remove('active');
        });

        const selectedItem = document.querySelector(`.chat-item[data-id="${chatId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
            
            // Eliminar el contador de no leídos al seleccionar
            const unreadBadge = selectedItem.querySelector('.unread-count');
            if (unreadBadge) {
                unreadBadge.remove();
            }
        }

        // IMPORTANTE: Actualizar variable global selectedChatId primero
        window.selectedChatId = chatId;
        selectedChatId = chatId;
        localStorage.setItem('selectedChatId', chatId);

        // Show chat messages area
        document.getElementById('empty-state').classList.add('hidden');
        document.getElementById('chat-messages').classList.remove('hidden');

        // Load messages for this chat
        loadMessages(chatId);

        // Reiniciar el temporizador de refresco con el nuevo chat
        window.chatRefreshInterval = setInterval(() => {
            if (selectedChatId) {
                loadMessages(selectedChatId);
                
                // Actualizar también la lista de chats para mantener todo sincronizado
                loadChats(false); // Recargar desde el principio
            }
        }, 30000);
    } finally {
        // Siempre desbloquear el procesamiento
        isProcessingChatSelect = false;
    }
}

// Format time for display
function formatTime(date) {
    const now = new Date();
    const isToday = now.toDateString() === date.toDateString();

    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString();
    }
}

// Search functionality
document.getElementById('search-chat').addEventListener('input', function(e) {
    const searchText = e.target.value.toLowerCase();
    const chatItems = document.querySelectorAll('.chat-item');

    chatItems.forEach(item => {
        const name = item.querySelector('.chat-name').textContent.toLowerCase();
        const preview = item.querySelector('.chat-preview').textContent.toLowerCase();

        if (name.includes(searchText) || preview.includes(searchText)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
});

// ⚡ INFINITE SCROLL - Versión con scroll event (más confiable)
document.addEventListener('DOMContentLoaded', function() {
    const chatsContainer = document.getElementById('chats-container');
    
    if (chatsContainer) {
        // Detectar scroll y cargar cuando estés cerca del final
        chatsContainer.addEventListener('scroll', function() {
            // Calcular posición
            const scrollPosition = chatsContainer.scrollTop + chatsContainer.offsetHeight;
            const scrollHeight = chatsContainer.scrollHeight;
            const nearBottom = scrollPosition >= scrollHeight - 200; // 200px antes del final
            
            // Log para debug
            if (nearBottom) {
                console.log('📍 Cerca del final:', {
                    scrollPosition,
                    scrollHeight,
                    hasMore: hasMoreChats,
                    isLoading: isLoadingMore
                });
            }
            
            // Cargar más si estamos cerca del final
            if (nearBottom && hasMoreChats && !isLoadingMore) {
                console.log('📥 Cargando más chats...');
                loadChats(true);
            }
        });
        
        console.log('✅ Infinite scroll activado con scroll event');
    } else {
        console.error('❌ No se encontró #chats-container');
    }

    // Temporizador de refresco (solo recarga la primera página)
    window.chatListRefreshInterval = setInterval(() => {
        if (!document.getElementById('chats-section')?.classList.contains('hidden')) {
            console.log('🔄 Refrescando chats...');
            loadChats(false); // Recargar desde el principio
        }
    }, 60000); // Cada minuto
});