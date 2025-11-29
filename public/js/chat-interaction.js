// Funcionalidad para la interacción humano/bot en el chat
let chatStatus = 'bot';
let statusChangeTime = null;
let timerInterval = null;
let lastStateChangeTime = 0; // Para evitar sobrescrituras accidentales

// Elementos del DOM
let messageForm, messageInput, sendButton, statusBadge, toggleStatusBtn, timerDisplay;

// Inicializar elementos DOM - previene errores si los elementos no existen inicialmente
function initDOMElements() {
    messageForm = document.getElementById('message-form');
    messageInput = document.getElementById('message-input');
    sendButton = document.querySelector('.send-btn');
    statusBadge = document.getElementById('status-badge');
    toggleStatusBtn = document.getElementById('toggle-status-btn');
    timerDisplay = document.getElementById('timer-display');
    
    console.log("Elementos DOM inicializados:", {
        messageForm: !!messageForm,
        messageInput: !!messageInput,
        sendButton: !!sendButton,
        statusBadge: !!statusBadge,
        toggleStatusBtn: !!toggleStatusBtn,
        timerDisplay: !!timerDisplay
    });
}

// Función para limpiar el estado del chat cuando se cambia de chat
function clearChatState() {
    console.log('Limpiando estado anterior del chat');
    
    // Reiniciar variables globales
    chatStatus = 'bot';
    statusChangeTime = null;
    lastStateChangeTime = 0;
    
    // Detener temporizador si existe
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // También reiniciar cualquier intervalo de actualización
    if (window.messageRefreshInterval) {
        clearInterval(window.messageRefreshInterval);
        window.messageRefreshInterval = null;
    }
    
    // Asegurarse que la UI se actualiza para el nuevo estado
    initDOMElements();
    updateStatusUI();
}

// Exponer la función al ámbito global
window.clearChatState = clearChatState;

// Inicializar la interfaz cuando se carga un chat
function initializeChatInterface(chat) {
    // Asegurar que tenemos los elementos DOM actualizados
    initDOMElements();
    
    if (!chat) return;
    
    // VERIFICAR QUE EL CHAT ID COINCIDE CON EL SELECCIONADO
    if (chat.chatId !== window.selectedChatId) {
        console.log(`Error: chatId no coincide - UI:${chat.chatId} vs seleccionado:${window.selectedChatId}`);
        return; // No inicializar si no coincide
    }

    console.log('Inicializando interfaz con datos:', chat);

    const now = new Date().getTime();
    const timeSinceLastChange = now - lastStateChangeTime;

    // Solo actualizar el estado si no ha habido un cambio manual reciente (10 segundos)
    if (timeSinceLastChange > 10000) {
        // Establecer el estado inicial
        chatStatus = chat.chatStatus || 'bot';
        statusChangeTime = chat.statusChangeTime ? new Date(chat.statusChangeTime) : null;

        console.log(`Estado inicial del chat: ${chatStatus}, tiempo: ${statusChangeTime}`);

        updateStatusUI();

        // Iniciar temporizador si es necesario
        if (chatStatus === 'human' && statusChangeTime) {
            startTimer();
        }
    } else {
        console.log('Ignorando actualización de estado por cambio reciente');
    }

    // Ajustar textarea para que crezca automáticamente (solo una vez)
    if (messageInput && !messageInput.hasInputListener) {
        messageInput.hasInputListener = true;
        
        // Input para ajustar altura automáticamente
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            // Limitar altura máxima
            if (parseInt(this.style.height) > 150) {
                this.style.height = '150px';
            }
        });

        // IMPORTANTE: Usar keypress en lugar de keydown para mejor compatibilidad
        messageInput.addEventListener('keypress', function(e) {
            // Verificar si es Enter sin Shift (Shift+Enter permite saltos de línea)
            if (e.key === 'Enter' && !e.shiftKey) {
                console.log("Tecla Enter presionada sin Shift - enviando mensaje");
                e.preventDefault(); // Prevenir el salto de línea por defecto
                if (chatStatus === 'human' && !sendButton.disabled) {
                    sendMessage(e);
                }
                return false; // Asegurar que no se inserte un salto de línea
            }
        });
    }

    // Manejar envío de mensaje (solo una vez)
    if (messageForm && !messageForm.hasSubmitListener) {
        messageForm.hasSubmitListener = true;
        messageForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log("Formulario enviado - llamando a sendMessage");
            sendMessage(e);
        });
    }
    
    // También asociar el evento al botón directamente como respaldo
    if (sendButton && !sendButton.hasClickListener) {
        sendButton.hasClickListener = true;
        sendButton.addEventListener('click', function(e) {
            console.log("Botón de envío clickeado");
            e.preventDefault(); // Prevenir comportamiento predeterminado
            
            if (messageForm) {
                console.log("Disparando evento submit en el formulario");
                const submitEvent = new Event('submit', {bubbles: true, cancelable: true});
                messageForm.dispatchEvent(submitEvent);
            } else {
                console.log("No se encontró formulario, llamando a sendMessage directamente");
                sendMessage(e);
            }
        });
    }

    // Manejar cambio de estado (solo una vez)
    if (toggleStatusBtn && !toggleStatusBtn.hasClickListener) {
        toggleStatusBtn.hasClickListener = true;
        toggleStatusBtn.addEventListener('click', toggleChatStatus);
    }
}

// Actualizar la UI según el estado actual
function updateStatusUI() {
    // Re-verificar elementos DOM
    initDOMElements();
    
    console.log(`Actualizando UI para estado: ${chatStatus}`);

    // Actualizar badge
    if (statusBadge) {
        statusBadge.textContent = chatStatus === 'bot' ? 'Bot' : 'Humano';
        statusBadge.className = 'status-badge ' + chatStatus;
    }

    // Actualizar botón
    if (toggleStatusBtn) {
        toggleStatusBtn.textContent = chatStatus === 'bot' ? 'Tomar control' : 'Devolver al bot';
    }

    // Habilitar/deshabilitar formulario
    if (chatStatus === 'bot') {
        if (messageForm) messageForm.classList.add('disabled');
        if (messageInput) messageInput.disabled = true;
        if (sendButton) sendButton.disabled = true;
        if (timerDisplay) timerDisplay.textContent = '';

        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    } else {
        if (messageForm) messageForm.classList.remove('disabled');
        if (messageInput) messageInput.disabled = false;
        if (sendButton) sendButton.disabled = false;

        if (statusChangeTime && !timerInterval) {
            startTimer();
        }
    }

    // Cambiar frecuencia de actualización según el estado
    if (window.messageRefreshInterval) {
        clearInterval(window.messageRefreshInterval);
        window.messageRefreshInterval = null;
    }

    // Establecer intervalo más corto solo si está en modo humano
    if (chatStatus === 'human' && window.selectedChatId) {
        window.messageRefreshInterval = setInterval(() => {
            console.log('Actualizando mensajes automáticamente (modo humano)');
            if (window.loadMessages && window.selectedChatId) {
                window.loadMessages(window.selectedChatId);
            }
        }, 10000); // Cada 10 segundos en modo humano
    }
}

// Cambiar el estado del chat
async function toggleChatStatus() {
    // Re-verificar elementos DOM
    initDOMElements();
    
    if (!window.selectedChatId) {
        console.error('No hay chat seleccionado');
        return;
    }

    try {
        const newStatus = chatStatus === 'bot' ? 'human' : 'bot';
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        console.log(`Cambiando estado a ${newStatus} para chat ${window.selectedChatId}`);

        // Guardar tiempo del cambio de estado
        lastStateChangeTime = new Date().getTime();

        // Actualizar UI inmediatamente como feedback visual
        if (toggleStatusBtn) {
            toggleStatusBtn.disabled = true;
            toggleStatusBtn.textContent = 'Procesando...';
        }

        // IMPORTANTE: Hacer un console.log para depurar la URL y el payload
        console.log('Enviando solicitud a:', `/api/chats/${window.selectedChatId}/status`);
        console.log('Con payload:', JSON.stringify({ status: newStatus }));

        // Usar la ruta correcta del API
        const response = await fetch(`/api/chats/${window.selectedChatId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({
                status: newStatus
            })
        });

        // IMPORTANTE: Hacer un console.log de la respuesta del servidor
        console.log('Status code de la respuesta:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Error al cambiar el estado');
        }

        const data = await response.json();
        console.log('Respuesta del servidor:', data);

        // Actualizar el estado local
        chatStatus = data.chatStatus || newStatus;
        statusChangeTime = data.statusChangeTime ? new Date(data.statusChangeTime) : null;

        console.log(`Estado actualizado a ${chatStatus}, tiempo: ${statusChangeTime}`);
        updateStatusUI();

    } catch (error) {
        console.error('Error al cambiar estado:', error);
        alert(`No se pudo cambiar el estado: ${error.message}`);
    } finally {
        if (toggleStatusBtn) {
            toggleStatusBtn.disabled = false;
            toggleStatusBtn.textContent = chatStatus === 'bot' ? 'Tomar control' : 'Devolver al bot';
        }
    }
}

// Enviar mensaje manual
function sendMessage(e) {
    if (e) e.preventDefault();
    
    // Re-verificar elementos DOM
    initDOMElements();
    
    console.log("Función sendMessage ejecutada");
    
    if (!window.selectedChatId) {
        console.error('No hay chat seleccionado');
        return;
    }

    if (chatStatus !== 'human') {
        alert('No puedes enviar mensajes mientras el chat está en modo bot');
        return;
    }

    if (!messageInput) {
        console.error('No se encontró el elemento de entrada de mensaje');
        return;
    }

    const content = messageInput.value.trim();
    if (!content) {
        console.log('Mensaje vacío, no se envía');
        return;
    }

    // Evitar envíos duplicados
    if (!sendButton || sendButton.disabled) {
        console.log('Botón deshabilitado, evitando envío duplicado');
        return;
    }

    console.log('Intentando enviar mensaje:', content);
    enviarMensajeAsync(content);
}

// Función para el envío asíncrono del mensaje
// FUNCIÓN CORREGIDA - Reemplazar completamente enviarMensajeAsync
async function enviarMensajeAsync(content) {
    // Re-verificar elementos DOM
    initDOMElements();
    
    // Deshabilitar interfaz durante el envío
    if (messageInput) messageInput.disabled = true;
    if (sendButton) sendButton.disabled = true;

    // Guardar referencia al HTML original
    let originalBtnHTML = '';
    if (sendButton) {
        originalBtnHTML = sendButton.innerHTML;
        sendButton.innerHTML = '<div class="loading-spinner"></div>';
    }

    // ✅ CRÍTICO: Variable para controlar el mensaje temporal
    let tempMessageId = null;
    let tempMessage = null;

    try {
        const token = localStorage.getItem('token');
        console.log('🚀 Enviando mensaje manual:', content);

        const response = await fetch(`/api/chats/${window.selectedChatId}/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ content })
        });

        const responseData = await response.json();
        console.log('📨 Respuesta del servidor:', responseData);

        if (!response.ok) {
            throw new Error(responseData.msg || 'Error al enviar el mensaje');
        }

        // ✅ SOLO SI LA RESPUESTA ES EXITOSA, crear mensaje temporal
        console.log('✅ Petición exitosa, creando mensaje temporal');
        
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
            // Crear ID único para el mensaje temporal
            tempMessageId = `temp-msg-${Date.now()}`;
            
            tempMessage = document.createElement('div');
            tempMessage.id = tempMessageId;
            tempMessage.classList.add('message', 'bot-message', 'sending');
            tempMessage.setAttribute('data-temp', 'true');
            tempMessage.setAttribute('data-temp-id', tempMessageId);
            tempMessage.innerHTML = `
                <div class="message-content">${content}</div>
                <div class="message-time">Enviando...</div>
            `;

            messagesContainer.appendChild(tempMessage);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            console.log(`📝 Mensaje temporal creado con ID: ${tempMessageId}`);
        }

        // Limpiar el input inmediatamente
        if (messageInput) {
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }

        console.log('✅ Mensaje enviado con éxito, recargando mensajes...');

        // ✅ RECARGAR mensajes con mejor manejo de errores
        setTimeout(async () => {
            try {
                if (typeof window.loadMessages === 'function' && window.selectedChatId) {
                    // Eliminar mensaje temporal ANTES de recargar
                    if (tempMessage && tempMessage.parentNode) {
                        console.log(`🗑️ Eliminando mensaje temporal: ${tempMessageId}`);
                        tempMessage.remove();
                        tempMessage = null;
                    }
                    
                    await window.loadMessages(window.selectedChatId);
                    console.log('🔄 Mensajes recargados exitosamente');
                } else {
                    console.warn('⚠️ loadMessages no disponible');
                }
            } catch (reloadError) {
                console.error('❌ Error recargando mensajes:', reloadError);
                // Si falla la recarga, al menos eliminar el temporal
                if (tempMessage && tempMessage.parentNode) {
                    tempMessage.remove();
                }
            }
        }, 1500);

    } catch (error) {
        console.error('❌ Error al enviar mensaje:', error);
        
        // ✅ NUNCA mostrar mensaje temporal si hay error
        // Si por alguna razón se creó, eliminarlo
        if (tempMessage && tempMessage.parentNode) {
            console.log('🗑️ Eliminando mensaje temporal por error');
            tempMessage.remove();
        }
        
        alert(`Error: ${error.message}`);
        
    } finally {
        // ✅ RESTAURAR interfaz SIEMPRE
        if (sendButton) {
            sendButton.innerHTML = originalBtnHTML || `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            `;
        }

        // ✅ TIMEOUT para evitar envíos duplicados
        setTimeout(() => {
            if (messageInput) messageInput.disabled = false;
            if (sendButton) sendButton.disabled = false;
            if (messageInput) messageInput.focus();
        }, 300);
        
        console.log('🔄 Interfaz restaurada');
    }
}

// Iniciar temporizador de 30 minutos
function startTimer() {
    if (!statusChangeTime) return;

    if (timerInterval) {
        clearInterval(timerInterval);
    }

    console.log('Iniciando temporizador de 30 minutos');

    // Actualización inicial inmediata
    updateTimerDisplay();

    // Actualizar cada segundo para que sea más preciso
    timerInterval = setInterval(updateTimerDisplay, 1000);
}

// Actualizar visualización del temporizador
function updateTimerDisplay() {
    // Re-verificar elementos DOM
    if (!timerDisplay) {
        timerDisplay = document.getElementById('timer-display');
        if (!timerDisplay) return;
    }

    if (!statusChangeTime) return;

    const now = new Date();
    const timePassed = now - statusChangeTime;
    const thirtyMinutes = 30 * 60 * 1000;
    const timeLeft = thirtyMinutes - timePassed;

    if (timeLeft <= 0) {
        // El tiempo ha expirado
        console.log('Temporizador expirado, volviendo a modo bot');
        clearInterval(timerInterval);
        timerInterval = null;

        chatStatus = 'bot';
        statusChangeTime = null;
        updateStatusUI();

        alert('El tiempo de control ha expirado. El chat ha vuelto al modo bot.');
        return;
    }

    // Calcular minutos y segundos restantes
    const minutesLeft = Math.floor(timeLeft / 60000);
    const secondsLeft = Math.floor((timeLeft % 60000) / 1000);

    timerDisplay.textContent = `Tiempo: ${minutesLeft}:${secondsLeft < 10 ? '0' : ''}${secondsLeft}`;
}

// Variable global para almacenar los datos del chat actual
window.currentChatData = window.currentChatData || null;

// Si loadMessages ya existe, modificarlo para preservar el estado del chat
const originalLoadMessages = window.loadMessages;
if (originalLoadMessages && typeof originalLoadMessages === 'function') {
    window.loadMessages = async function(chatId) {
        console.log('Cargando mensajes para chat:', chatId);

        // Guardar estado actual antes de cargar
        const currentStatus = chatStatus;
        const currentStatusTime = statusChangeTime;

        // Verificar si hubo un cambio de estado reciente
        const now = new Date().getTime();
        const recentStateChange = (now - lastStateChangeTime) < 10000;

        await originalLoadMessages(chatId);

        // Inicializar interfaz solo si no hubo un cambio de estado reciente
        if (window.currentChatData && window.currentChatData.chat && !recentStateChange) {
            console.log('Actualizando interfaz con datos del servidor');
            initializeChatInterface(window.currentChatData.chat);
        } else if (recentStateChange) {
            console.log('Manteniendo estado local debido a cambio reciente');
            chatStatus = currentStatus;
            statusChangeTime = currentStatusTime;
            updateStatusUI();
        }
    };
}

// Modificación de selectChat si existe
if (window.selectChat && typeof window.selectChat === 'function') {
    const originalSelectChat = window.selectChat;
    window.selectChat = function(chatId) {
        console.log('Seleccionando chat:', chatId);
        
        // Limpiar el estado antes de cambiar de chat
        clearChatState();
        
        // Llamar a la función original
        originalSelectChat(chatId);

        // Inicializar interfaz después de un breve delay para permitir que los datos se carguen
        setTimeout(() => {
            if (window.currentChatData && window.currentChatData.chat) {
                initializeChatInterface(window.currentChatData.chat);
            }
        }, 500);
    };
}

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, inicializando chat-interaction.js');
    
    // Inicializar elementos DOM
    initDOMElements();
    
    // Verificar que sendButton tenga un listener para click como respaldo
    if (sendButton && !sendButton.hasClickListener) {
        console.log("Agregando listener al botón de envío durante la carga inicial");
        sendButton.hasClickListener = true;
        sendButton.addEventListener('click', function(e) {
            console.log("Botón de envío clickeado");
            e.preventDefault();
            sendMessage(e);
        });
    }

    // Si hay un chat seleccionado, inicializar
    const savedChatId = localStorage.getItem('selectedChatId');
    if (savedChatId && typeof window.loadMessages === 'function') {
        console.log('Cargando chat guardado:', savedChatId);
        window.selectedChatId = savedChatId;
        setTimeout(() => {
            if (window.loadMessages) {
                window.loadMessages(savedChatId);
            }
        }, 500);
    }
});
