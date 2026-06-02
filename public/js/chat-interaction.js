let chatStatus = 'bot';
let statusChangeTime = null;
let timerInterval = null;
let lastStateChangeTime = 0;

let messageForm;
let messageInput;
let sendButton;
let statusBadge;
let toggleStatusBtn;
let timerDisplay;
let emojiToggleBtn;
let stickerToggleBtn;
let emojiPanel;
let stickerPanel;
let emojiGrid;
let defaultStickerGrid;
let customStickerGrid;
let stickerNameInput;
let stickerSourceInput;
let stickerPreviewCanvas;
let saveStickerBtn;
let sendCreatedStickerBtn;

let createdStickerBlob = null;
let stickerLibraryLoaded = false;
let customStickers = [];

const EMOJIS = ['😀', '😂', '😍', '🙏', '👍', '🔥', '🎉', '✨', '👋', '✅', '💬', '❤️'];
const DEFAULT_STICKERS = [
    { id: 'preset-hola', name: 'Hola', emoji: '👋', accent: '#25D366', textColor: '#103529' },
    { id: 'preset-gracias', name: 'Gracias', emoji: '🙏', accent: '#FFE082', textColor: '#5C4300' },
    { id: 'preset-ok', name: 'Ok', emoji: '👌', accent: '#90CAF9', textColor: '#0D3557' },
    { id: 'preset-genial', name: 'Genial', emoji: '✨', accent: '#F8BBD0', textColor: '#5E2144' },
    { id: 'preset-volvemos', name: 'Volvemos', emoji: '⏳', accent: '#D1C4E9', textColor: '#34224D' },
    { id: 'preset-oferta', name: 'Oferta', emoji: '🔥', accent: '#FFCCBC', textColor: '#6B2414' }
];

function initDOMElements() {
    messageForm = document.getElementById('message-form');
    messageInput = document.getElementById('message-input');
    sendButton = document.querySelector('.send-btn');
    statusBadge = document.getElementById('status-badge');
    toggleStatusBtn = document.getElementById('toggle-status-btn');
    timerDisplay = document.getElementById('timer-display');
    emojiToggleBtn = document.getElementById('emoji-toggle-btn');
    stickerToggleBtn = document.getElementById('sticker-toggle-btn');
    emojiPanel = document.getElementById('emoji-panel');
    stickerPanel = document.getElementById('sticker-panel');
    emojiGrid = document.getElementById('emoji-grid');
    defaultStickerGrid = document.getElementById('default-sticker-grid');
    customStickerGrid = document.getElementById('custom-sticker-grid');
    stickerNameInput = document.getElementById('sticker-name-input');
    stickerSourceInput = document.getElementById('sticker-source-input');
    stickerPreviewCanvas = document.getElementById('sticker-preview-canvas');
    saveStickerBtn = document.getElementById('save-sticker-btn');
    sendCreatedStickerBtn = document.getElementById('send-created-sticker-btn');
}

function clearChatState() {
    chatStatus = 'bot';
    statusChangeTime = null;
    lastStateChangeTime = 0;

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    if (window.messageRefreshInterval) {
        clearInterval(window.messageRefreshInterval);
        window.messageRefreshInterval = null;
    }

    closePanels();
    initDOMElements();
    updateStatusUI();
}

window.clearChatState = clearChatState;

function initializeChatInterface(chat) {
    initDOMElements();
    if (!chat || chat.chatId !== window.selectedChatId) {
        return;
    }

    const now = Date.now();
    if (now - lastStateChangeTime > 10000) {
        chatStatus = chat.chatStatus || 'bot';
        statusChangeTime = chat.statusChangeTime ? new Date(chat.statusChangeTime) : null;
        updateStatusUI();

        if (chatStatus === 'human' && statusChangeTime) {
            startTimer();
        }
    }

    if (messageInput && !messageInput.dataset.bound) {
        messageInput.dataset.bound = 'true';
        messageInput.addEventListener('input', autoResizeTextarea);
        messageInput.addEventListener('keypress', handleInputKeypress);
    }

    if (messageForm && !messageForm.dataset.bound) {
        messageForm.dataset.bound = 'true';
        messageForm.addEventListener('submit', sendMessage);
    }

    if (sendButton && !sendButton.dataset.bound) {
        sendButton.dataset.bound = 'true';
        sendButton.addEventListener('click', sendMessage);
    }

    if (toggleStatusBtn && !toggleStatusBtn.dataset.bound) {
        toggleStatusBtn.dataset.bound = 'true';
        toggleStatusBtn.addEventListener('click', toggleChatStatus);
    }

    if (emojiToggleBtn && !emojiToggleBtn.dataset.bound) {
        emojiToggleBtn.dataset.bound = 'true';
        emojiToggleBtn.addEventListener('click', () => togglePanel('emoji'));
    }

    if (stickerToggleBtn && !stickerToggleBtn.dataset.bound) {
        stickerToggleBtn.dataset.bound = 'true';
        stickerToggleBtn.addEventListener('click', async () => {
            try {
                await togglePanel('sticker');
            } catch (error) {
                alert(error.message);
            }
        });
    }

    if (stickerSourceInput && !stickerSourceInput.dataset.bound) {
        stickerSourceInput.dataset.bound = 'true';
        stickerSourceInput.addEventListener('change', handleStickerSourceChange);
    }

    if (saveStickerBtn && !saveStickerBtn.dataset.bound) {
        saveStickerBtn.dataset.bound = 'true';
        saveStickerBtn.addEventListener('click', async () => {
            try {
                await saveCreatedSticker();
            } catch (error) {
                alert(error.message);
            }
        });
    }

    if (sendCreatedStickerBtn && !sendCreatedStickerBtn.dataset.bound) {
        sendCreatedStickerBtn.dataset.bound = 'true';
        sendCreatedStickerBtn.addEventListener('click', async () => {
            try {
                await sendCreatedSticker();
            } catch (error) {
                alert(error.message);
            }
        });
    }

    renderEmojiGrid();
    renderDefaultStickerGrid();
}

function autoResizeTextarea() {
    this.style.height = 'auto';
    this.style.height = `${Math.min(this.scrollHeight, 150)}px`;
}

function handleInputKeypress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (chatStatus === 'human' && sendButton && !sendButton.disabled) {
            sendMessage(e);
        }
    }
}

function updateStatusUI() {
    initDOMElements();

    if (statusBadge) {
        statusBadge.textContent = chatStatus === 'bot' ? 'Bot' : 'Humano';
        statusBadge.className = `status-badge ${chatStatus}`;
    }

    if (toggleStatusBtn) {
        toggleStatusBtn.textContent = chatStatus === 'bot' ? 'Tomar control' : 'Devolver al bot';
    }

    const disabled = chatStatus === 'bot';

    if (messageForm) {
        messageForm.classList.toggle('disabled', disabled);
    }

    [messageInput, sendButton, emojiToggleBtn, stickerToggleBtn].forEach((element) => {
        if (element) {
            element.disabled = disabled;
        }
    });

    if (disabled) {
        if (timerDisplay) {
            timerDisplay.textContent = '';
        }
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        closePanels();
    } else if (statusChangeTime && !timerInterval) {
        startTimer();
    }

    if (window.messageRefreshInterval) {
        clearInterval(window.messageRefreshInterval);
        window.messageRefreshInterval = null;
    }

    if (!disabled && window.selectedChatId) {
        window.messageRefreshInterval = setInterval(() => {
            if (window.loadMessages) {
                window.loadMessages(window.selectedChatId);
            }
        }, 10000);
    }
}

async function toggleChatStatus() {
    initDOMElements();

    if (!window.selectedChatId) {
        return;
    }

    try {
        const newStatus = chatStatus === 'bot' ? 'human' : 'bot';
        const token = localStorage.getItem('token');
        lastStateChangeTime = Date.now();

        if (toggleStatusBtn) {
            toggleStatusBtn.disabled = true;
            toggleStatusBtn.textContent = 'Procesando...';
        }

        const response = await fetch(`/api/chats/${window.selectedChatId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.msg || 'Error al cambiar el estado');
        }

        chatStatus = data.chatStatus || newStatus;
        statusChangeTime = data.statusChangeTime ? new Date(data.statusChangeTime) : null;
        updateStatusUI();
    } catch (error) {
        alert(`No se pudo cambiar el estado: ${error.message}`);
    } finally {
        if (toggleStatusBtn) {
            toggleStatusBtn.disabled = false;
            toggleStatusBtn.textContent = chatStatus === 'bot' ? 'Tomar control' : 'Devolver al bot';
        }
    }
}

function sendMessage(e) {
    if (e) {
        e.preventDefault();
    }

    initDOMElements();
    if (!window.selectedChatId || chatStatus !== 'human' || !messageInput) {
        return;
    }

    const content = messageInput.value.trim();
    if (!content || !sendButton || sendButton.disabled) {
        return;
    }

    enviarMensajeAsync({ content });
}

async function enviarMensajeAsync({ content = '', file = null, fileName = '', tempType = 'text', previewUrl = '' }) {
    initDOMElements();

    if (messageInput) {
        messageInput.disabled = true;
    }
    if (sendButton) {
        sendButton.disabled = true;
    }
    if (emojiToggleBtn) {
        emojiToggleBtn.disabled = true;
    }
    if (stickerToggleBtn) {
        stickerToggleBtn.disabled = true;
    }

    let originalBtnHTML = '';
    if (sendButton) {
        originalBtnHTML = sendButton.innerHTML;
        sendButton.innerHTML = '<div class="loading-spinner"></div>';
    }

    let tempMessage = null;

    try {
        const token = localStorage.getItem('token');
        const requestOptions = {
            method: 'POST',
            headers: {
                'x-auth-token': token
            }
        };

        if (file) {
            const formData = new FormData();
            formData.append('content', content);
            formData.append('file', file, fileName || 'sticker.webp');
            requestOptions.body = formData;
        } else {
            requestOptions.headers['Content-Type'] = 'application/json';
            requestOptions.body = JSON.stringify({ content });
        }

        const response = await fetch(`/api/chats/${window.selectedChatId}/message`, requestOptions);
        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.msg || 'Error al enviar el mensaje');
        }

        tempMessage = appendTemporaryMessage({ content, tempType, previewUrl });

        if (!file && messageInput) {
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }

        if (file && tempType === 'sticker') {
            resetStickerCreator();
        }

        setTimeout(async () => {
            try {
                if (tempMessage && tempMessage.parentNode) {
                    tempMessage.remove();
                }
                if (window.loadMessages && window.selectedChatId) {
                    await window.loadMessages(window.selectedChatId);
                }
            } catch (error) {
                if (tempMessage && tempMessage.parentNode) {
                    tempMessage.remove();
                }
            }
        }, 1200);
    } catch (error) {
        if (tempMessage && tempMessage.parentNode) {
            tempMessage.remove();
        }
        alert(`Error: ${error.message}`);
    } finally {
        if (sendButton) {
            sendButton.innerHTML = originalBtnHTML || '';
        }

        setTimeout(() => {
            updateStatusUI();
            if (messageInput) {
                messageInput.disabled = chatStatus === 'bot';
                messageInput.focus();
            }
        }, 300);
    }
}

function appendTemporaryMessage({ content, tempType, previewUrl }) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) {
        return null;
    }

    const tempMessage = document.createElement('div');
    tempMessage.classList.add('message', 'bot-message', 'sending');
    tempMessage.dataset.temp = 'true';

    let mediaHtml = '';
    if (tempType === 'sticker' && previewUrl) {
        mediaHtml = `<img src="${previewUrl}" alt="Sticker" class="message-media message-sticker">`;
    }

    const safeContent = content ? escapeHtml(content) : '';
    tempMessage.innerHTML = `
        ${mediaHtml}
        ${safeContent ? `<div class="message-content">${safeContent}</div>` : ''}
        <div class="message-time">Enviando...</div>
    `;

    messagesContainer.appendChild(tempMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return tempMessage;
}

function startTimer() {
    if (!statusChangeTime) {
        return;
    }

    if (timerInterval) {
        clearInterval(timerInterval);
    }

    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
    if (!timerDisplay || !statusChangeTime) {
        return;
    }

    const timeLeft = (30 * 60 * 1000) - (Date.now() - statusChangeTime.getTime());
    if (timeLeft <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        chatStatus = 'bot';
        statusChangeTime = null;
        updateStatusUI();
        alert('El tiempo de control ha expirado. El chat ha vuelto al modo bot.');
        return;
    }

    const minutesLeft = Math.floor(timeLeft / 60000);
    const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
    timerDisplay.textContent = `Tiempo: ${minutesLeft}:${secondsLeft < 10 ? '0' : ''}${secondsLeft}`;
}

function renderEmojiGrid() {
    if (!emojiGrid || emojiGrid.dataset.ready === 'true') {
        return;
    }

    emojiGrid.innerHTML = '';
    EMOJIS.forEach((emoji) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'emoji-option';
        button.textContent = emoji;
        button.addEventListener('click', () => insertEmoji(emoji));
        emojiGrid.appendChild(button);
    });

    emojiGrid.dataset.ready = 'true';
}

function insertEmoji(emoji) {
    if (!messageInput || messageInput.disabled) {
        return;
    }

    const start = messageInput.selectionStart || messageInput.value.length;
    const end = messageInput.selectionEnd || messageInput.value.length;
    messageInput.value = `${messageInput.value.slice(0, start)}${emoji}${messageInput.value.slice(end)}`;
    messageInput.focus();
    messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
    autoResizeTextarea.call(messageInput);
}

async function togglePanel(panelName) {
    if (chatStatus === 'bot') {
        return;
    }

    const targetPanel = panelName === 'emoji' ? emojiPanel : stickerPanel;
    const otherPanel = panelName === 'emoji' ? stickerPanel : emojiPanel;

    if (!targetPanel) {
        return;
    }

    otherPanel?.classList.add('hidden');

    const willOpen = targetPanel.classList.contains('hidden');
    targetPanel.classList.toggle('hidden', !willOpen);

    if (panelName === 'sticker' && willOpen) {
        await loadStickerLibrary();
    }
}

function closePanels() {
    if (emojiPanel) {
        emojiPanel.classList.add('hidden');
    }
    if (stickerPanel) {
        stickerPanel.classList.add('hidden');
    }
}

function renderDefaultStickerGrid() {
    if (!defaultStickerGrid || defaultStickerGrid.dataset.ready === 'true') {
        return;
    }

    defaultStickerGrid.innerHTML = '';
    DEFAULT_STICKERS.forEach((preset) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sticker-card';
        button.innerHTML = `
            <span class="sticker-card-emoji">${preset.emoji}</span>
            <span class="sticker-card-name">${escapeHtml(preset.name)}</span>
        `;
        button.addEventListener('click', async () => {
            const blob = await createPresetStickerBlob(preset);
            const previewUrl = URL.createObjectURL(blob);
            await enviarMensajeAsync({
                file: blob,
                fileName: `${slugify(preset.name)}.webp`,
                tempType: 'sticker',
                previewUrl
            });
            setTimeout(() => URL.revokeObjectURL(previewUrl), 3000);
        });
        defaultStickerGrid.appendChild(button);
    });

    defaultStickerGrid.dataset.ready = 'true';
}

async function loadStickerLibrary() {
    if (stickerLibraryLoaded && customStickerGrid) {
        renderCustomStickerGrid();
        return;
    }

    const token = localStorage.getItem('token');
    const response = await fetch(`/api/stickers${buildClientQuery()}`, {
        headers: {
            'x-auth-token': token
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.msg || 'No se pudieron cargar los stickers');
    }

    customStickers = data.custom || [];
    stickerLibraryLoaded = true;
    renderCustomStickerGrid();
}

function renderCustomStickerGrid() {
    if (!customStickerGrid) {
        return;
    }

    customStickerGrid.innerHTML = '';

    if (!customStickers.length) {
        customStickerGrid.innerHTML = '<div class="sticker-card"><span class="sticker-card-name">Todavía no hay stickers guardados</span></div>';
        return;
    }

    customStickers.forEach((sticker) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sticker-card';
        button.innerHTML = `
            <img src="${sticker.fileUrl}" alt="${escapeHtml(sticker.name)}" class="sticker-thumb">
            <span class="sticker-card-name">${escapeHtml(sticker.name)}</span>
        `;
        button.addEventListener('click', async () => {
            const response = await fetch(sticker.fileUrl);
            const blob = await response.blob();
            const previewUrl = URL.createObjectURL(blob);
            await enviarMensajeAsync({
                file: blob,
                fileName: `${slugify(sticker.name)}.webp`,
                tempType: 'sticker',
                previewUrl
            });
            setTimeout(() => URL.revokeObjectURL(previewUrl), 3000);
        });
        customStickerGrid.appendChild(button);
    });
}

async function handleStickerSourceChange(event) {
    try {
        const file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }

        const image = await fileToImage(file);
        drawImageStickerPreview(image);
        createdStickerBlob = await exportCanvasToWebp(stickerPreviewCanvas);
        updateStickerActionButtons();
    } catch (error) {
        createdStickerBlob = null;
        updateStickerActionButtons();
        alert(error.message);
    }
}

function drawImageStickerPreview(image) {
    if (!stickerPreviewCanvas) {
        return;
    }

    const ctx = stickerPreviewCanvas.getContext('2d');
    const size = stickerPreviewCanvas.width;
    const radius = 52;
    const padding = 36;

    ctx.clearRect(0, 0, size, size);
    roundRect(ctx, 0, 0, size, size, radius);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    const drawableSize = size - (padding * 2);
    const scale = Math.min(drawableSize / image.width, drawableSize / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const x = (size - drawWidth) / 2;
    const y = (size - drawHeight) / 2;

    ctx.save();
    roundRect(ctx, padding / 2, padding / 2, size - padding, size - padding, 36);
    ctx.clip();
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
    ctx.restore();
}

async function saveCreatedSticker() {
    if (!createdStickerBlob) {
        return;
    }

    const token = localStorage.getItem('token');
    const formData = new FormData();
    const stickerName = (stickerNameInput?.value || 'Sticker').trim();

    formData.append('name', stickerName);
    formData.append('category', 'custom');
    formData.append('clientId', getActiveClientId());
    formData.append('sticker', createdStickerBlob, `${slugify(stickerName)}.webp`);

    const response = await fetch('/api/stickers', {
        method: 'POST',
        headers: {
            'x-auth-token': token
        },
        body: formData
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.msg || 'No se pudo guardar el sticker');
    }

    customStickers.unshift(data.sticker);
    stickerLibraryLoaded = true;
    renderCustomStickerGrid();
}

async function sendCreatedSticker() {
    if (!createdStickerBlob) {
        return;
    }

    const stickerName = (stickerNameInput?.value || 'Sticker').trim();
    const previewUrl = URL.createObjectURL(createdStickerBlob);

    await enviarMensajeAsync({
        file: createdStickerBlob,
        fileName: `${slugify(stickerName)}.webp`,
        tempType: 'sticker',
        previewUrl
    });

    setTimeout(() => URL.revokeObjectURL(previewUrl), 3000);
}

function updateStickerActionButtons() {
    const disabled = !createdStickerBlob || chatStatus === 'bot';
    if (saveStickerBtn) {
        saveStickerBtn.disabled = disabled;
    }
    if (sendCreatedStickerBtn) {
        sendCreatedStickerBtn.disabled = disabled;
    }
}

function resetStickerCreator() {
    createdStickerBlob = null;
    if (stickerSourceInput) {
        stickerSourceInput.value = '';
    }
    if (stickerNameInput) {
        stickerNameInput.value = '';
    }
    if (stickerPreviewCanvas) {
        const ctx = stickerPreviewCanvas.getContext('2d');
        ctx.clearRect(0, 0, stickerPreviewCanvas.width, stickerPreviewCanvas.height);
    }
    updateStickerActionButtons();
}

async function createPresetStickerBlob(preset) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    roundRect(ctx, 0, 0, canvas.width, canvas.height, 64);
    ctx.fillStyle = preset.accent;
    ctx.fill();

    ctx.font = '220px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(preset.emoji, canvas.width / 2, 210);

    ctx.fillStyle = preset.textColor;
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(preset.name.toUpperCase(), canvas.width / 2, 390);

    return exportCanvasToWebp(canvas);
}

function fileToImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function exportCanvasToWebp(canvas) {
    let quality = 0.92;
    let blob = await canvasToBlob(canvas, quality);

    while (blob.size > 100 * 1024 && quality > 0.5) {
        quality -= 0.08;
        blob = await canvasToBlob(canvas, quality);
    }

    if (blob.size > 100 * 1024) {
        throw new Error('No se pudo generar un sticker menor a 100 KB');
    }

    return blob;
}

function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('No se pudo exportar el sticker'));
                return;
            }
            resolve(blob);
        }, 'image/webp', quality);
    });
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function slugify(value) {
    return String(value || 'sticker')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'sticker';
}

function getActiveClientId() {
    if (window.currentChatData && window.currentChatData.chat && window.currentChatData.chat.clientId) {
        return window.currentChatData.chat.clientId;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.clientId || '';
}

function buildClientQuery() {
    const clientId = getActiveClientId();
    return clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

window.currentChatData = window.currentChatData || null;

const originalLoadMessages = window.loadMessages;
if (originalLoadMessages && typeof originalLoadMessages === 'function') {
    window.loadMessages = async function(chatId) {
        const currentStatus = chatStatus;
        const currentStatusTime = statusChangeTime;
        const recentStateChange = (Date.now() - lastStateChangeTime) < 10000;

        await originalLoadMessages(chatId);

        if (window.currentChatData && window.currentChatData.chat && !recentStateChange) {
            initializeChatInterface(window.currentChatData.chat);
        } else if (recentStateChange) {
            chatStatus = currentStatus;
            statusChangeTime = currentStatusTime;
            updateStatusUI();
        }
    };
}

if (window.selectChat && typeof window.selectChat === 'function') {
    const originalSelectChat = window.selectChat;
    window.selectChat = function(chatId) {
        clearChatState();
        originalSelectChat(chatId);

        setTimeout(() => {
            if (window.currentChatData && window.currentChatData.chat) {
                initializeChatInterface(window.currentChatData.chat);
            }
        }, 500);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    initDOMElements();
    renderEmojiGrid();
    renderDefaultStickerGrid();
    updateStickerActionButtons();

    const savedChatId = localStorage.getItem('selectedChatId');
    if (savedChatId && typeof window.loadMessages === 'function') {
        window.selectedChatId = savedChatId;
        setTimeout(() => {
            if (window.loadMessages) {
                window.loadMessages(savedChatId);
            }
        }, 500);
    }
});
