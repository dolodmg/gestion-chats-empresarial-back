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

// Function to load messages for a specific chat
async function loadMessages(chatId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No se encontró el token de autenticación');
        }

        // Mostrar indicador de carga
        const messagesContainer = document.getElementById('messages-container');
        const oldScrollTop = messagesContainer.scrollTop;
        const isAtBottom = (messagesContainer.scrollHeight - messagesContainer.clientHeight) <= (messagesContainer.scrollTop + 10);

        const response = await fetch(`/api/chats/${chatId}`, {
            method: 'GET',
            headers: {
                'x-auth-token': token
            }
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.msg || 'Error al cargar los mensajes');
        }

        const data = await response.json();
        
        // Guardar los datos completos del chat en una variable global para acceder desde otros scripts
        window.currentChatData = data;

        if (data && data.messages) {
            displayMessages(data.messages, isAtBottom, oldScrollTop);
            if (data.chat) {
                updateChatHeader(data.chat);
            }
        } else {
            console.error('Formato de datos incorrecto:', data);
            document.getElementById('messages-container').innerHTML = '<div class="no-messages">Los mensajes no tienen el formato esperado</div>';
        }

    } catch (error) {
        handleAuthError(error);
        console.error('Error:', error);
        document.getElementById('messages-container').innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
    }
}

// Function to display messages
function displayMessages(messages, isAtBottom, oldScrollTop) {
    const messagesContainer = document.getElementById('messages-container');
    
    // ✅ ÚNICO CAMBIO: Limpiar mensajes temporales ANTES de innerHTML = ''
    const tempMessages = messagesContainer.querySelectorAll('[data-temp="true"]');
    tempMessages.forEach(tempMsg => tempMsg.remove());
    if (tempMessages.length > 0) {
        console.log(`🧹 Limpiados ${tempMessages.length} mensajes temporales en displayMessages`);
    }
    
    // EL RESTO DE TU CÓDIGO SIN CAMBIOS:
    messagesContainer.innerHTML = '';

    if (!messages || messages.length === 0) {
        messagesContainer.innerHTML = '<div class="no-messages">No hay mensajes</div>';
        return;
    }

    // Hacer una copia para no modificar el original
    const sortedMessages = [...messages];
    
    // Convertir todos los timestamps a Date para comparación y ordenamiento
    sortedMessages.forEach(msg => {
        if (typeof msg.timestamp === 'string') {
            msg.timestamp = new Date(msg.timestamp);
        }
    });
    
    // Ordenar explícitamente por timestamp
    sortedMessages.sort((a, b) => {
        const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
        const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
        return dateA - dateB;
    });
    
    // Log para depuración
    console.log('Mensajes ordenados:', sortedMessages.map(m => ({
        content: m.content,
        timestamp: m.timestamp,
        date: new Date(m.timestamp).toLocaleString()
    })));

    let lastDate = null;

    sortedMessages.forEach(message => {
        // Validar el mensaje
        if (!message || typeof message.content === 'undefined' || message.content === null) {
            return; // Skip invalid messages
        }

        // Check if we need to display a date separator
        const messageDate = new Date(message.timestamp);
        const messageDay = messageDate.toDateString();

        if (lastDate !== messageDay) {
            const dateSeparator = document.createElement('div');
            dateSeparator.classList.add('date-separator');
            dateSeparator.textContent = formatDate(messageDate);
            messagesContainer.appendChild(dateSeparator);
            lastDate = messageDay;
        }

        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(message.sender === 'bot' ? 'bot-message' : 'user-message');

        messageElement.innerHTML = `
            <div class="message-content">${message.content}</div>
            <div class="message-time">${formatMessageTime(messageDate)}</div>
        `;

        messagesContainer.appendChild(messageElement);
    });

    // Solo hacer scroll al fondo si el usuario ya estaba en el fondo antes
    if (isAtBottom) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
        // Intentar mantener la posición aproximada
        messagesContainer.scrollTop = oldScrollTop;
    }
}

// Function to update chat header
function updateChatHeader(chat) {
    const contactName = document.getElementById('contact-name');
    if (chat && contactName) {
        contactName.textContent = chat.contactName || chat.phoneNumber || 'Contacto';
    }
}

// Format date for separators
function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        console.warn('Fecha inválida:', date);
        return 'Fecha desconocida';
    }

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (date.toDateString() === now.toDateString()) {
        return 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Ayer';
    } else {
        return date.toLocaleDateString();
    }
}

// Format time for messages
function formatMessageTime(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        return '--:--';
    }
    // Mostrar la hora en la zona horaria local
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
