document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticación
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token) {
        window.location.href = '/';
        return;
    }

    // Variables globales
    let currentPrompt = '';
    let currentVersion = 1;
    let currentWorkflowId = '';
    let currentNodeId = '';
    let selectedPromptForRestore = null;

    // Elementos del DOM
    let userNameEl = document.getElementById('user-name');
    let promptTextarea = document.getElementById('prompt-textarea');
    let descriptionInput = document.getElementById('description-input');
    let saveBtn = document.getElementById('save-btn');
    let cancelBtn = document.getElementById('cancel-btn');
    let loadingContainer = document.getElementById('loading-container');
    let promptContainer = document.getElementById('prompt-container');
    let errorContainer = document.getElementById('error-container');
    let statusMessage = document.getElementById('status-message');
    let versionInfo = document.getElementById('version-info');
    let charCount = document.getElementById('char-count');
    let historyBtn = document.getElementById('history-btn');
    let historyModal = document.getElementById('history-modal');
    let restoreModal = document.getElementById('restore-modal');

    // Mostrar nombre de usuario
    if (userNameEl) {
        userNameEl.textContent = user.name || 'Usuario';
    }

    // Función para inicializar elementos DOM
    function initializeElements() {
        userNameEl = document.getElementById('user-name');
        promptTextarea = document.getElementById('prompt-textarea');
        descriptionInput = document.getElementById('description-input');
        saveBtn = document.getElementById('save-btn');
        cancelBtn = document.getElementById('cancel-btn');
        loadingContainer = document.getElementById('loading-container');
        promptContainer = document.getElementById('prompt-container');
        errorContainer = document.getElementById('error-container');
        statusMessage = document.getElementById('status-message');
        versionInfo = document.getElementById('version-info');
        charCount = document.getElementById('char-count');
        historyBtn = document.getElementById('history-btn');
        historyModal = document.getElementById('history-modal');
        restoreModal = document.getElementById('restore-modal');

        console.log('Elementos inicializados:', {
            historyBtn: !!historyBtn,
            historyModal: !!historyModal,
            promptContainer: !!promptContainer
        });
    }

    // Inicializar elementos
    initializeElements();

    // Manejadores de eventos básicos
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = '/index.html';
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('selectedChatId');
            window.location.href = '/';
        });
    }

    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', loadPrompt);
    }

    // Contador de caracteres
    if (promptTextarea && charCount) {
        promptTextarea.addEventListener('input', function() {
            charCount.textContent = `${this.value.length} caracteres`;
        });
    }

    // Botón guardar
    if (saveBtn) {
        saveBtn.addEventListener('click', savePrompt);
    }

    // Botón cancelar
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            if (promptTextarea && descriptionInput && charCount) {
                promptTextarea.value = currentPrompt;
                descriptionInput.value = '';
                charCount.textContent = `${currentPrompt.length} caracteres`;
                showStatusMessage('Cambios cancelados', 'info');
            }
        });
    }

    // CORRECCIÓN: Inicializar botón de historial
    function initializeHistoryButton() {
        console.log('Inicializando botón de historial...');
        const historyBtnElement = document.getElementById('history-btn');
        
        if (historyBtnElement) {
            console.log('Botón de historial encontrado, agregando listener');
            
            // Remover listeners existentes
            historyBtnElement.removeEventListener('click', handleHistoryClick);
            
            // Agregar nuevo listener
            historyBtnElement.addEventListener('click', handleHistoryClick);
            
            console.log('Listener agregado correctamente al botón de historial');
        } else {
            console.error('Botón de historial NO encontrado en el DOM');
        }
    }

    // Función para manejar el click del historial
    function handleHistoryClick(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Botón historial clickeado - ejecutando showHistoryModal');
        showHistoryModal();
    }

    // Cerrar modales
    document.querySelectorAll('.modal-close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // Confirmación de restauración
    const restoreCancelBtn = document.getElementById('restore-cancel');
    if (restoreCancelBtn) {
        restoreCancelBtn.addEventListener('click', function() {
            if (restoreModal) {
                restoreModal.style.display = 'none';
            }
            selectedPromptForRestore = null;
        });
    }

    const restoreConfirmBtn = document.getElementById('restore-confirm');
    if (restoreConfirmBtn) {
        restoreConfirmBtn.addEventListener('click', confirmRestore);
    }

    const reloadHistoryBtn = document.getElementById('reload-history-btn');
    if (reloadHistoryBtn) {
        reloadHistoryBtn.addEventListener('click', loadHistory);
    }

    // Funciones principales
    async function loadPrompt() {
        try {
            showLoading();

            const queryParams = user.role === 'admin' && user.selectedClientId 
                ? `?clientId=${user.selectedClientId}` 
                : '';

            const response = await fetch(`/api/assistant/prompt${queryParams}`, {
                method: 'GET',
                headers: {
                    'x-auth-token': token
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al cargar el prompt');
            }

            currentPrompt = data.prompt || '';
            currentVersion = data.version || 1;
            currentWorkflowId = data.workflowId || '';
            currentNodeId = data.nodeId || '';

            if (promptTextarea && charCount && versionInfo) {
                promptTextarea.value = currentPrompt;
                charCount.textContent = `${currentPrompt.length} caracteres`;
                
                if (data.lastUpdated) {
                    const lastUpdated = new Date(data.lastUpdated).toLocaleString();
                    versionInfo.textContent = `v${currentVersion} - Última actualización: ${lastUpdated}`;
                } else {
                    versionInfo.textContent = `v${currentVersion}`;
                }
            }

            showPromptEditor();

        } catch (error) {
            showError(error.message);
        }
    }

    async function savePrompt() {
        try {
            if (!promptTextarea || !descriptionInput) {
                throw new Error('Elementos del formulario no encontrados');
            }

            const newPrompt = promptTextarea.value.trim();
            const description = descriptionInput.value.trim();

            if (!newPrompt) {
                showStatusMessage('El prompt no puede estar vacío', 'error');
                return;
            }

            if (newPrompt === currentPrompt) {
                showStatusMessage('No hay cambios para guardar', 'info');
                return;
            }

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Guardando...';
            }

            const queryParams = user.role === 'admin' && user.selectedClientId 
                ? `?clientId=${user.selectedClientId}` 
                : '';

            const response = await fetch(`/api/assistant/prompt${queryParams}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify({
                    prompt: newPrompt,
                    description: description || 'Actualización del prompt'
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al guardar el prompt');
            }

            currentPrompt = newPrompt;
            currentVersion = data.version || currentVersion + 1;
            if (descriptionInput) {
                descriptionInput.value = '';
            }

            if (versionInfo) {
                const now = new Date().toLocaleString();
                versionInfo.textContent = `v${currentVersion} - Última actualización: ${now}`;
            }

            showStatusMessage('Prompt actualizado correctamente', 'success');

        } catch (error) {
            showStatusMessage(`Error: ${error.message}`, 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Guardar Cambios';
            }
        }
    }

    async function showHistoryModal() {
        console.log('Ejecutando showHistoryModal');
        
        if (!historyModal) {
            console.error('Modal de historial no encontrado');
            historyModal = document.getElementById('history-modal');
            if (!historyModal) {
                console.error('Modal de historial sigue sin encontrarse');
                return;
            }
        }
        
        console.log('Mostrando modal de historial');
        historyModal.style.display = 'block';
        await loadHistory();
    }

    async function loadHistory(page = 1) {
        try {
            const historyLoadingEl = document.getElementById('history-loading');
            const historyContentEl = document.getElementById('history-content');
            const historyErrorEl = document.getElementById('history-error');

            if (historyLoadingEl) historyLoadingEl.style.display = 'block';
            if (historyContentEl) historyContentEl.style.display = 'none';
            if (historyErrorEl) historyErrorEl.style.display = 'none';

            const queryParams = user.role === 'admin' && user.selectedClientId 
                ? `?clientId=${user.selectedClientId}&page=${page}&limit=10` 
                : `?page=${page}&limit=10`;

            const response = await fetch(`/api/assistant/prompt/history${queryParams}`, {
                method: 'GET',
                headers: {
                    'x-auth-token': token
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al cargar el historial');
            }

            displayHistory(data.prompts, data.pagination);

        } catch (error) {
            console.error('Error cargando historial:', error);
            const historyLoadingEl = document.getElementById('history-loading');
            const historyErrorEl = document.getElementById('history-error');
            
            if (historyLoadingEl) historyLoadingEl.style.display = 'none';
            if (historyErrorEl) historyErrorEl.style.display = 'block';
        }
    }

    function displayHistory(prompts, pagination) {
        const historyLoadingEl = document.getElementById('history-loading');
        const historyContentEl = document.getElementById('history-content');

        if (historyLoadingEl) historyLoadingEl.style.display = 'none';
        if (historyContentEl) historyContentEl.style.display = 'block';

        const historyList = document.getElementById('history-list');
        if (!historyList) return;

        historyList.innerHTML = '';

        if (!prompts || prompts.length === 0) {
            historyList.innerHTML = '<div class="no-history">No hay historial disponible</div>';
            return;
        }

        prompts.forEach(prompt => {
            const historyItem = document.createElement('div');
            historyItem.className = `history-item ${prompt.isActive ? 'active' : ''}`;
            
            const date = new Date(prompt.createdAt).toLocaleString();
            const previewText = prompt.promptText.substring(0, 150) + (prompt.promptText.length > 150 ? '...' : '');
            
            historyItem.innerHTML = `
                <div class="history-header">
                    <div class="history-meta">
                        <span class="version">v${prompt.version}</span>
                        <span class="date">${date}</span>
                        ${prompt.isActive ? '<span class="active-badge">Actual</span>' : ''}
                    </div>
                    <div class="history-actions">
                        ${!prompt.isActive ? `<button class="btn-small restore-btn" data-prompt-id="${prompt._id}">Restaurar</button>` : ''}
                        <button class="btn-small view-btn" data-prompt-text="${encodeURIComponent(prompt.promptText)}">Ver completo</button>
                    </div>
                </div>
                <div class="history-description">${prompt.description}</div>
                <div class="history-preview">${previewText}</div>
            `;

            historyList.appendChild(historyItem);
        });

        // Event listeners para botones de historial
        historyList.querySelectorAll('.restore-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                selectedPromptForRestore = this.getAttribute('data-prompt-id');
                if (restoreModal) {
                    restoreModal.style.display = 'block';
                }
            });
        });

        historyList.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const promptText = decodeURIComponent(this.getAttribute('data-prompt-text'));
                showPromptPreview(promptText);
            });
        });

        // Generar paginación
        generatePagination(pagination);
    }

    function generatePagination(pagination) {
        const paginationEl = document.getElementById('history-pagination');
        if (!paginationEl) return;

        paginationEl.innerHTML = '';

        if (pagination.totalPages <= 1) return;

        const currentPage = pagination.page;
        const totalPages = pagination.totalPages;

        // Botón anterior
        if (currentPage > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'btn-small';
            prevBtn.textContent = 'Anterior';
            prevBtn.addEventListener('click', () => loadHistory(currentPage - 1));
            paginationEl.appendChild(prevBtn);
        }

        // Números de página
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `btn-small ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => loadHistory(i));
            paginationEl.appendChild(pageBtn);
        }

        // Botón siguiente
        if (currentPage < totalPages) {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn-small';
            nextBtn.textContent = 'Siguiente';
            nextBtn.addEventListener('click', () => loadHistory(currentPage + 1));
            paginationEl.appendChild(nextBtn);
        }
    }

    async function confirmRestore() {
        if (!selectedPromptForRestore) return;

        try {
            if (restoreModal) {
                restoreModal.style.display = 'none';
            }

            const queryParams = user.role === 'admin' && user.selectedClientId 
                ? `?clientId=${user.selectedClientId}` 
                : '';

            const response = await fetch(`/api/assistant/prompt/restore/${selectedPromptForRestore}${queryParams}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al restaurar el prompt');
            }

            showStatusMessage('Prompt restaurado correctamente', 'success');
            if (historyModal) {
                historyModal.style.display = 'none';
            }
            
            // Recargar el prompt actual
            await loadPrompt();

        } catch (error) {
            showStatusMessage(`Error: ${error.message}`, 'error');
        } finally {
            selectedPromptForRestore = null;
        }
    }

    function showPromptPreview(promptText) {
        // Crear modal temporal para mostrar el prompt completo
        const previewModal = document.createElement('div');
        previewModal.className = 'modal';
        previewModal.innerHTML = `
            <div class="modal-content">
                <span class="modal-close">&times;</span>
                <h3>Vista previa del prompt</h3>
                <div class="prompt-preview">
                    <pre>${promptText}</pre>
                </div>
            </div>
        `;

        document.body.appendChild(previewModal);
        previewModal.style.display = 'block';

        // Cerrar modal
        previewModal.querySelector('.modal-close').addEventListener('click', function() {
            document.body.removeChild(previewModal);
        });

        previewModal.addEventListener('click', function(e) {
            if (e.target === previewModal) {
                document.body.removeChild(previewModal);
            }
        });
    }

    // Funciones de UI
    function showLoading() {
        if (loadingContainer) loadingContainer.style.display = 'block';
        if (promptContainer) promptContainer.style.display = 'none';
        if (errorContainer) errorContainer.style.display = 'none';
    }

    function showPromptEditor() {
        if (loadingContainer) loadingContainer.style.display = 'none';
        if (promptContainer) promptContainer.style.display = 'block';
        if (errorContainer) errorContainer.style.display = 'none';
    }

    function showError(message) {
        if (loadingContainer) loadingContainer.style.display = 'none';
        if (promptContainer) promptContainer.style.display = 'none';
        if (errorContainer) errorContainer.style.display = 'block';
        
        const errorMessageEl = document.getElementById('error-message');
        if (errorMessageEl) {
            errorMessageEl.textContent = message;
        }
    }

    function showStatusMessage(message, type = 'info') {
        if (!statusMessage) return;

        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type === 'success' ? 'success-message' : type === 'error' ? 'error-message' : ''}`;
        statusMessage.style.display = 'block';

        // Ocultar después de 5 segundos
        setTimeout(() => {
            if (statusMessage) {
                statusMessage.style.display = 'none';
            }
        }, 5000);
    }

    // IMPORTANTE: Inicializar el botón de historial después de que todo esté cargado
    setTimeout(() => {
        initializeHistoryButton();
        
        // Debugging adicional
        console.log('=== DEBUGGING ELEMENTOS ===');
        console.log('historyBtn:', document.getElementById('history-btn'));
        console.log('historyModal:', document.getElementById('history-modal'));
        console.log('promptContainer:', document.getElementById('prompt-container'));
        console.log('===========================');
    }, 500);

    // Cargar prompt inicial
    loadPrompt();
});