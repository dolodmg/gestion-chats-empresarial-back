// Variables globales
let clientTables = [];
let currentTable = null;
let tableData = [];
let currentPage = 1;
let editingRecord = null;

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Verificar autenticación
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Solo usuarios cliente pueden acceder
    if (user.role !== 'client') {
        window.location.href = '/';
        return;
    }

    // Mostrar nombre de usuario
    document.getElementById('user-name').textContent = user.name || 'Usuario';

    // Configurar event listeners
    setupEventListeners();

    // Cargar tablas del cliente
    loadClientTables();
});

// Configurar todos los event listeners
function setupEventListeners() {
    // Botón volver al chat
    document.getElementById('back-to-chats-btn').addEventListener('click', function() {
        window.location.href = '/index.html';
    });

    // Botón cerrar sesión
    document.getElementById('logout-btn').addEventListener('click', function() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('selectedChatId');
        window.location.href = '/';
    });

    // Botón volver a lista de tablas
    const backToTablesBtn = document.getElementById('back-to-tables-btn');
    if (backToTablesBtn) {
        backToTablesBtn.addEventListener('click', showTablesList);
    }

    // Botón agregar registro
    const addRecordBtn = document.getElementById('add-record-btn');
    if (addRecordBtn) {
        addRecordBtn.addEventListener('click', showAddRecordModal);
    }

    // Buscador con delay
    const searchInput = document.getElementById('table-search');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (currentTable) {
                    loadTableData(currentTable._id, 1, this.value);
                }
            }, 500);
        });
    }

    // Formulario de registro
    const recordForm = document.getElementById('record-form');
    if (recordForm) {
        recordForm.addEventListener('submit', saveRecord);
    }

    // Cerrar modales
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    // Cerrar modal haciendo clic fuera
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

// Cargar tablas del cliente
async function loadClientTables() {
    try {
        showLoading();
        
        const token = localStorage.getItem('token');
        const response = await fetch('/api/custom-tables', {
            headers: { 'x-auth-token': token }
        });

        if (!response.ok) {
            throw new Error('Error al cargar las tablas');
        }

        const data = await response.json();
        clientTables = data.tables || [];
        
        displayClientTables();

    } catch (error) {
        console.error('Error:', error);
        showError('Error al cargar tus tablas de datos');
    }
}

// Mostrar lista de tablas del cliente
function displayClientTables() {
    const container = document.getElementById('client-tables-list');
    
    if (clientTables.length === 0) {
        container.innerHTML = `
            <div class="empty-data">
                <div class="empty-data-icon">📊</div>
                <h3>No tienes tablas de datos</h3>
                <p>Contacta al administrador para configurar tus tablas personalizadas</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    
    clientTables.forEach(table => {
        const card = document.createElement('div');
        card.className = 'table-card';
        
        const fieldsCount = table.fields.length;
        const requiredFields = table.fields.filter(f => f.required).length;

        card.innerHTML = `
            <div class="table-card-header">
                <h3 class="table-card-title">${table.tableName}</h3>
                <div class="table-card-actions">
                    <button class="btn primary-btn btn-small" onclick="openTable('${table._id}')">
                        Ver/Gestionar Datos
                    </button>
                </div>
            </div>
            <div class="table-card-meta">
                <span><strong>Campos:</strong> ${fieldsCount} (${requiredFields} requeridos)</span>
            </div>
            ${table.description ? `<div class="table-card-description">${table.description}</div>` : ''}
            <div class="table-fields-preview">
                ${table.fields.map(field => 
                    `<span class="field-tag ${field.required ? 'required' : ''}" title="${field.type}">
                        ${field.label}${field.required ? ' *' : ''}
                    </span>`
                ).join('')}
            </div>
        `;

        container.appendChild(card);
    });
}

// Abrir una tabla específica
function openTable(tableId) {
    currentTable = clientTables.find(t => t._id === tableId);
    
    if (!currentTable) {
        showError('Tabla no encontrada');
        return;
    }

    // Cambiar a vista de datos
    document.getElementById('tables-overview').style.display = 'none';
    document.getElementById('table-data-view').style.display = 'block';
    
    // Actualizar información del header
    document.getElementById('table-data-title').textContent = currentTable.tableName;
    document.getElementById('table-data-icon').textContent = currentTable.tableName.charAt(0).toUpperCase();
    
    // Cargar datos
    loadTableData(tableId);
}

// Cargar datos de una tabla
async function loadTableData(tableId, page = 1, search = '') {
    try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({
            page: page,
            limit: 20,
            search: search
        });

        const response = await fetch(`/api/custom-tables/${tableId}/data?${params}`, {
            headers: { 'x-auth-token': token }
        });

        if (!response.ok) {
            throw new Error('Error al cargar los datos');
        }

        const result = await response.json();
        tableData = result.data;
        currentPage = result.pagination.page;
        
        displayTableData(result);
        createPagination(result.pagination);

    } catch (error) {
        console.error('Error:', error);
        showError('Error al cargar los datos');
    }
}

// 🔧 Renderizar datos de tabla con preview para textarea (solo lectura con "Ver más")
function displayTableData(result) {
    const container = document.getElementById('data-table-container');
    const { data, table } = result;
    
    if (data.length === 0) {
        container.innerHTML = `
            <div class="empty-data">
                <div class="empty-data-icon">📄</div>
                <h3>No hay registros</h3>
                <p>Agrega el primer registro a tu tabla</p>
            </div>
        `;
        return;
    }

    // Crear tabla HTML
    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    ${table.fields.map(field => `<th>${field.label}</th>`).join('')}
                    <th class="actions-column">Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(record => {
        tableHTML += '<tr>';
        
        // Mostrar cada campo
        table.fields.forEach(field => {
            let value = record[field.name];
            
            // Formatear según tipo de campo
            if (field.type === 'date' && value) {
                value = new Date(value).toLocaleDateString();
            } else if (field.type === 'boolean') {
                value = value ? 'Sí' : 'No';
            } else if (field.type === 'textarea' && value) {
                // Preview con "Ver más" SOLO en la grilla
                if (value.length > 50) {
                    const preview = value.substring(0, 50) + '...';
                    const escapedValue = value
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#x27;')
                        .replace(/\\/g, '\\\\')
                        .replace(/`/g, '\\`');
                    value = `
                        <div class="textarea-cell">
                            <span class="textarea-preview-text" title="${escapedValue}">${preview}</span>
                            <button class="btn-link view-full-btn" onclick="showFullText('${record._id}', '${field.name}', \`${escapedValue}\`)">
                                Ver más
                            </button>
                        </div>
                    `;
                } else {
                    value = value || '-';
                }
            } else if (!value && value !== 0) {
                value = '-';
            }
            
            tableHTML += `<td>${value}</td>`;
        });
        
        // Botones de acción
        tableHTML += `
            <td class="actions-column">
                <div class="record-actions">
                    <button class="record-btn edit-record-btn" onclick="editRecord('${record._id}')" title="Editar">✏️</button>
                    <button class="record-btn delete-record-btn" onclick="deleteRecord('${record._id}')" title="Eliminar">🗑️</button>
                </div>
            </td>
        `;
        
        tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}

// Volver a la lista de tablas
function showTablesList() {
    document.getElementById('table-data-view').style.display = 'none';
    document.getElementById('tables-overview').style.display = 'block';
    currentTable = null;
    tableData = [];
}

// Mostrar modal para agregar registro
function showAddRecordModal() {
    const modal = document.getElementById('record-modal');
    const title = document.getElementById('record-modal-title');
    
    title.textContent = 'Agregar Nuevo Registro';
    editingRecord = null;
    
    createRecordForm();
    modal.style.display = 'block';
}

// 🔧 Crear formulario dinámico (textarea editable directo, sin "Ver más")
function createRecordForm() {
    const container = document.getElementById('record-form-fields');
    container.innerHTML = '';
    
    currentTable.fields.forEach(field => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'record-form-row';
        
        // Label
        const label = document.createElement('label');
        label.textContent = field.label;
        if (field.required) {
            label.innerHTML += ' <span class="required-field">*</span>';
        }
        
        // Input según tipo de campo
        let input;
        
        switch (field.type) {
            case 'textarea': {
                input = document.createElement('textarea');
                input.name = field.name;
                input.rows = 4; // editable directo
                input.placeholder = field.placeholder || '';
                input.required = !!field.required;
                // Validaciones
                if (field.validation) {
                    if (field.validation.minLength) input.minLength = field.validation.minLength;
                    if (field.validation.maxLength) input.maxLength = field.validation.maxLength;
                }
                fieldDiv.appendChild(label);
                fieldDiv.appendChild(input);
                break;
            }
            case 'select': {
                input = document.createElement('select');
                if (!field.required) {
                    const defaultOption = document.createElement('option');
                    defaultOption.value = '';
                    defaultOption.textContent = 'Seleccionar...';
                    input.appendChild(defaultOption);
                }
                (field.options || []).forEach(option => {
                    const optionEl = document.createElement('option');
                    optionEl.value = option;
                    optionEl.textContent = option;
                    input.appendChild(optionEl);
                });
                
                input.name = field.name;
                input.required = !!field.required;
                
                fieldDiv.appendChild(label);
                fieldDiv.appendChild(input);
                break;
            }
            case 'boolean': {
                input = document.createElement('select');
                const options = [
                    { value: 'true', text: 'Sí' },
                    { value: 'false', text: 'No' }
                ];
                options.forEach(opt => {
                    const optionEl = document.createElement('option');
                    optionEl.value = opt.value;
                    optionEl.textContent = opt.text;
                    input.appendChild(optionEl);
                });
                
                input.name = field.name;
                input.required = !!field.required;
                
                fieldDiv.appendChild(label);
                fieldDiv.appendChild(input);
                break;
            }
            default: {
                input = document.createElement('input');
                input.type = getInputType(field.type);
                input.name = field.name;
                input.placeholder = field.placeholder || '';
                input.required = !!field.required;
                
                // Validaciones
                if (field.validation) {
                    if (field.validation.minLength) input.minLength = field.validation.minLength;
                    if (field.validation.maxLength) input.maxLength = field.validation.maxLength;
                    if (field.validation.min !== undefined) input.min = field.validation.min;
                    if (field.validation.max !== undefined) input.max = field.validation.max;
                }
                
                fieldDiv.appendChild(label);
                fieldDiv.appendChild(input);
            }
        }
        
        container.appendChild(fieldDiv);
    });
}

// Convertir tipo de campo a tipo de input HTML
function getInputType(fieldType) {
    const types = {
        'email': 'email',
        'phone': 'tel',
        'number': 'number',
        'date': 'date'
    };
    return types[fieldType] || 'text';
}

// Guardar registro (crear o actualizar)
async function saveRecord(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = editingRecord ? 'Actualizando...' : 'Guardando...';
        
        // Recopilar datos del formulario
        const formData = new FormData(e.target);
        const recordData = {};
        
        currentTable.fields.forEach(field => {
            let value = formData.get(field.name);
            
            // Convertir tipos
            if (field.type === 'boolean') {
                value = value === 'true';
            } else if (field.type === 'number' && value) {
                value = parseFloat(value);
            } else if (field.type === 'date' && value) {
                value = new Date(value);
            }
            
            recordData[field.name] = value;
        });
        
        // Determinar URL y método
        const token = localStorage.getItem('token');
        let url, method;
        
        if (editingRecord) {
            url = `/api/custom-tables/${currentTable._id}/data/${editingRecord}`;
            method = 'PUT';
        } else {
            url = `/api/custom-tables/${currentTable._id}/data`;
            method = 'POST';
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify(recordData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Error al guardar');
        }
        
        showSuccess(editingRecord ? 'Registro actualizado correctamente' : 'Registro creado correctamente');
        
        // Cerrar modal y recargar datos
        document.getElementById('record-modal').style.display = 'none';
        loadTableData(currentTable._id, currentPage);
        
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Editar registro
function editRecord(recordId) {
    const record = tableData.find(r => r._id === recordId);
    
    if (!record) {
        showError('Registro no encontrado');
        return;
    }
    
    const modal = document.getElementById('record-modal');
    const title = document.getElementById('record-modal-title');
    
    title.textContent = 'Editar Registro';
    editingRecord = recordId;
    
    // Crear formulario
    createRecordForm();
    
    // Llenar con datos existentes
    currentTable.fields.forEach(field => {
        let value = record[field.name];
        const input = document.querySelector(`[name="${field.name}"]`);
        if (!input || value === undefined) return;

        if (field.type === 'date' && value) {
            value = new Date(value).toISOString().split('T')[0];
        } else if (field.type === 'boolean') {
            value = value.toString();
        }
        // Para textarea ahora es un textarea editable normal: setear value
        input.value = value ?? '';
    });
    
    modal.style.display = 'block';
}

// Eliminar registro
async function deleteRecord(recordId) {
    if (!confirm('¿Eliminar este registro?\n\nEsta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/custom-tables/${currentTable._id}/data/${recordId}`, {
            method: 'DELETE',
            headers: { 'x-auth-token': token }
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Error al eliminar');
        }
        
        showSuccess('Registro eliminado correctamente');
        loadTableData(currentTable._id, currentPage);
        
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    }
}

// 🆕 Mostrar texto completo en modal (solo lectura para la grilla)
function showFullText(recordId, fieldName, fullText) {
    // Decodificar el texto
    const decodedText = fullText.replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
    
    // Crear modal si no existe
    let modal = document.getElementById('view-text-modal');
    if (!modal) {
        modal = createViewTextModal();
        document.body.appendChild(modal);
    }
    
    // Configurar modal
    const modalTitle = modal.querySelector('.view-text-modal-title');
    const modalContent = modal.querySelector('.view-text-content');
    const field = currentTable.fields.find(f => f.name === fieldName);
    
    modalTitle.textContent = field ? field.label : 'Texto Completo';
    modalContent.textContent = decodedText;
    
    modal.style.display = 'block';
}

// Crear modal para ver texto completo
function createViewTextModal() {
    const modal = document.createElement('div');
    modal.id = 'view-text-modal';
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-content view-text-modal-content">
            <span class="modal-close">&times;</span>
            <h2 class="view-text-modal-title">Texto Completo</h2>
            
            <div class="view-text-body">
                <div class="view-text-content"></div>
            </div>
            
            <div class="modal-actions">
                <button type="button" class="btn primary-btn" onclick="this.closest('.modal').style.display='none'">
                    Cerrar
                </button>
            </div>
        </div>
    `;
    
    // Event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    return modal;
}

// Crear paginación
function createPagination(pagination) {
    const container = document.getElementById('table-pagination');
    container.innerHTML = '';

    if (pagination.totalPages <= 1) return;

    const { page, totalPages } = pagination;

    // Botón anterior
    if (page > 1) {
        const prevBtn = createPageButton('Anterior', page - 1);
        container.appendChild(prevBtn);
    }

    // Números de página
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);

    for (let i = start; i <= end; i++) {
        const pageBtn = createPageButton(i, i, i === page);
        container.appendChild(pageBtn);
    }

    // Botón siguiente
    if (page < totalPages) {
        const nextBtn = createPageButton('Siguiente', page + 1);
        container.appendChild(nextBtn);
    }
}

// Crear botón de página
function createPageButton(text, targetPage, isActive = false) {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = isActive ? 'active' : '';
    button.addEventListener('click', () => {
        if (currentTable) {
            const search = document.getElementById('table-search').value;
            loadTableData(currentTable._id, targetPage, search);
        }
    });
    return button;
}

// Mostrar mensaje de éxito
function showSuccess(message) {
    const messageEl = createMessage('client-success-message', 'success-message', message);
    setTimeout(() => messageEl.style.display = 'none', 5000);
}

// Mostrar mensaje de error
function showError(message) {
    const messageEl = createMessage('client-error-message', 'error-message', message);
    setTimeout(() => messageEl.style.display = 'none', 10000);
}

// Crear elemento de mensaje
function createMessage(id, className, message) {
    let messageEl = document.getElementById(id);
    
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.id = id;
        messageEl.className = className;
        const container = document.querySelector('.table-data-container') || document.querySelector('.custom-tables-container');
        if (container) {
            container.prepend(messageEl);
        }
    }
    
    messageEl.textContent = message;
    messageEl.style.display = 'block';
    return messageEl;
}

// Mostrar indicador de carga
function showLoading() {
    const container = document.getElementById('client-tables-list');
    container.innerHTML = `
        <div style="text-align: center; padding: 50px;">
            <div class="loading-indicator"></div>
            <p>Cargando tus tablas...</p>
        </div>
    `;
}

// Funciones globales para usar desde HTML
window.openTable = openTable;
window.editRecord = editRecord;
window.deleteRecord = deleteRecord;
// Exponer función para mostrar texto completo (grilla)
window.showFullText = showFullText;
