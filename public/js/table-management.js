// table-management.js
// Variables globales
let currentClientId = null;
let currentClientName = null;
let currentTables = [];
let fieldCounter = 0;
let collectionNameTimeout = null;
let editingTableId = null;

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token || user.role !== 'admin') {
        window.location.href = '/';
        return;
    }

    // Obtener parámetros de la URL
    const urlParams = new URLSearchParams(window.location.search);
    currentClientId = urlParams.get('clientId');
    currentClientName = urlParams.get('userName');

    if (!currentClientId) {
        alert('Cliente no especificado');
        window.location.href = '/admin';
        return;
    }

    // Mostrar información del cliente
    document.getElementById('client-name').textContent = currentClientName || currentClientId;
    document.getElementById('user-name').textContent = user.name || 'Administrador';

    // Configurar event listeners
    setupEventListeners();

    // Cargar tablas del cliente
    loadClientTables();
});

// Configurar todos los event listeners
function setupEventListeners() {
    // Botón volver al admin
    document.getElementById('back-to-admin-btn').addEventListener('click', function() {
        window.location.href = '/admin';
    });

    // Botón cerrar sesión
    document.getElementById('logout-btn').addEventListener('click', function() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('selectedChatId');
        window.location.href = '/';
    });

    // Botón crear nueva tabla
    document.getElementById('create-table-btn').addEventListener('click', openCreateTableModal);

    // Botón reintentar
    document.getElementById('retry-btn').addEventListener('click', loadClientTables);

    // Verificación de nombre de colección
    document.getElementById('table-collection-name').addEventListener('input', debounceCheckCollectionName);

    // Botón agregar campo
    document.getElementById('add-field-btn').addEventListener('click', addField);

    // Formulario de crear tabla
    document.getElementById('create-table-form').addEventListener('submit', handleCreateTable);

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

    // Modal de confirmación de eliminación
    document.getElementById('delete-cancel').addEventListener('click', function() {
        document.getElementById('confirm-delete-modal').style.display = 'none';
    });

    document.getElementById('delete-confirm').addEventListener('click', confirmDeleteTable);
}

// Cargar tablas del cliente específico
async function loadClientTables() {
    try {
        showLoading();

        const token = localStorage.getItem('token');
        const response = await fetch(`/api/custom-tables?clientId=${currentClientId}`, {
            method: 'GET',
            headers: {
                'x-auth-token': token
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar las tablas');
        }

        const data = await response.json();
        currentTables = data.tables || [];
        
        showContent();
        displayTables();

    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    }
}

// Mostrar tablas en la interfaz
function displayTables() {
    const container = document.getElementById('tables-list');

    if (currentTables.length === 0) {
        container.innerHTML = `
            <div class="empty-data">
                <div class="empty-data-icon">📊</div>
                <h3>No hay tablas personalizadas</h3>
                <p>Crea la primera tabla personalizada para este cliente</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    currentTables.forEach(table => {
        const tableCard = createTableCard(table);
        container.appendChild(tableCard);
    });
}

// Crear tarjeta de tabla
function createTableCard(table) {
    const card = document.createElement('div');
    card.className = 'table-card';
    
    const fieldsCount = table.fields.length;
    const requiredFields = table.fields.filter(f => f.required).length;

    card.innerHTML = `
        <div class="table-card-header">
            <h3 class="table-card-title">${table.tableName}</h3>
            <div class="table-card-actions">
                <button class="btn secondary-btn btn-small" onclick="viewTableData('${table._id}')">
                    Ver Datos
                </button>
                <button class="btn secondary-btn btn-small" onclick="editTable('${table._id}')">
                    Editar
                </button>
                <button class="btn delete-btn btn-small" onclick="deleteTable('${table._id}')">
                    Eliminar
                </button>
            </div>
        </div>
        <div class="table-card-meta">
            <span><strong>Colección:</strong> ${table.collectionName}</span>
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

    return card;
}

// Abrir modal para crear tabla
function openCreateTableModal() {
    const modal = document.getElementById('table-modal');
    const modalTitle = document.getElementById('table-modal-title');
    const form = document.getElementById('create-table-form');
    
    modalTitle.textContent = 'Crear Nueva Tabla Personalizada';
    form.reset();
    editingTableId = null;
    
    // Habilitar campo de colección
    document.getElementById('table-collection-name').disabled = false;
    
    // Limpiar campos dinámicos
    const fieldsContainer = document.getElementById('fields-container');
    fieldsContainer.innerHTML = '';
    fieldCounter = 0;
    
    // Agregar primer campo por defecto
    addField();
    
    modal.style.display = 'block';
}

// Verificar disponibilidad del nombre de colección (con debounce)
function debounceCheckCollectionName() {
    const input = document.getElementById('table-collection-name');
    const status = document.getElementById('collection-name-status');
    
    if (collectionNameTimeout) {
        clearTimeout(collectionNameTimeout);
    }

    status.textContent = 'Verificando...';
    status.className = 'collection-name-status status-checking';

    collectionNameTimeout = setTimeout(async () => {
        await checkCollectionName(input.value);
    }, 500);
}

// Verificar nombre de colección
async function checkCollectionName(collectionName) {
    const status = document.getElementById('collection-name-status');
    
    if (!collectionName.trim()) {
        status.textContent = '';
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/custom-tables/check-name?collectionName=${encodeURIComponent(collectionName)}`, {
            method: 'GET',
            headers: {
                'x-auth-token': token
            }
        });

        const data = await response.json();
        
        if (data.available) {
            status.textContent = '✓ Disponible';
            status.className = 'collection-name-status status-available';
        } else {
            status.textContent = '✗ No disponible';
            status.className = 'collection-name-status status-unavailable';
        }

    } catch (error) {
        console.error('Error verificando nombre:', error);
        status.textContent = '⚠ Error verificando';
        status.className = 'collection-name-status status-unavailable';
    }
}

// Agregar nuevo campo
function addField() {
    fieldCounter++;
    const fieldsContainer = document.getElementById('fields-container');
    
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'field-item';
    fieldDiv.dataset.fieldId = fieldCounter;
    
    fieldDiv.innerHTML = `
        <div class="field-header">
            <div style="display: flex; align-items: center;">
                <span class="field-number">${fieldCounter}</span>
                <span style="font-weight: 500;">Campo ${fieldCounter}</span>
            </div>
            <button type="button" class="remove-field-btn" onclick="removeField(${fieldCounter})" title="Eliminar campo">
                ×
            </button>
        </div>
        
        <div class="field-grid">
            <div class="form-row">
                <label>Nombre del campo *</label>
                <input type="text" name="field_name_${fieldCounter}" required 
                       placeholder="Ej: nombre_producto" 
                       pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
                       title="Debe empezar con una letra y solo contener letras, números y guiones bajos">
            </div>
            
            <div class="form-row">
                <label>Etiqueta *</label>
                <input type="text" name="field_label_${fieldCounter}" required 
                       placeholder="Ej: Nombre del Producto">
            </div>
            
            <div class="form-row">
                <label>Tipo *</label>
                <select name="field_type_${fieldCounter}" required onchange="handleFieldTypeChange(${fieldCounter}, this.value)">
                    <option value="string">Texto</option>
                    <option value="number">Número</option>
                    <option value="email">Email</option>
                    <option value="phone">Teléfono</option>
                    <option value="date">Fecha</option>
                    <option value="boolean">Sí/No</option>
                    <option value="textarea">Texto largo</option>
                    <option value="select">Lista de opciones</option>
                </select>
            </div>
        </div>
        
        <div class="form-row">
            <label>Placeholder (opcional)</label>
            <input type="text" name="field_placeholder_${fieldCounter}" 
                   placeholder="Texto de ayuda para el usuario">
        </div>
        
        <div class="field-checkboxes">
            <div class="checkbox-group">
                <input type="checkbox" id="required_${fieldCounter}" name="field_required_${fieldCounter}">
                <label for="required_${fieldCounter}">Campo requerido</label>
            </div>
        </div>
        
        <div class="field-options" id="field_options_${fieldCounter}" style="display: none;">
            <label>Opciones (una por línea)</label>
            <textarea name="field_options_${fieldCounter}" placeholder="Opción 1&#10;Opción 2&#10;Opción 3"></textarea>
        </div>
        
        <div class="validation-section" id="validation_${fieldCounter}" style="display: none;">
            <h4>Validaciones</h4>
            <div class="validation-grid">
                <div class="form-row">
                    <label>Mínimo</label>
                    <input type="number" name="field_min_${fieldCounter}" placeholder="Valor mínimo">
                </div>
                <div class="form-row">
                    <label>Máximo</label>
                    <input type="number" name="field_max_${fieldCounter}" placeholder="Valor máximo">
                </div>
            </div>
        </div>
    `;
    
    fieldsContainer.appendChild(fieldDiv);
    
    // Trigger del tipo para mostrar opciones si es necesario
    handleFieldTypeChange(fieldCounter, 'string');
}

// Manejar cambio de tipo de campo
function handleFieldTypeChange(fieldId, fieldType) {
    const optionsDiv = document.getElementById(`field_options_${fieldId}`);
    const validationDiv = document.getElementById(`validation_${fieldId}`);
    
    // Mostrar opciones solo para tipo 'select'
    if (fieldType === 'select') {
        optionsDiv.style.display = 'block';
        optionsDiv.querySelector('textarea').required = true;
    } else {
        optionsDiv.style.display = 'none';
        optionsDiv.querySelector('textarea').required = false;
    }
    
    // Mostrar validaciones para tipos numéricos y de texto
    if (['string', 'number', 'textarea'].includes(fieldType)) {
        validationDiv.style.display = 'block';
        
        // Cambiar labels según el tipo
        const minLabel = validationDiv.querySelector('label');
        const maxLabel = validationDiv.querySelectorAll('label')[1];
        
        if (fieldType === 'number') {
            minLabel.textContent = 'Valor mínimo';
            maxLabel.textContent = 'Valor máximo';
        } else {
            minLabel.textContent = 'Longitud mínima';
            maxLabel.textContent = 'Longitud máxima';
        }
    } else {
        validationDiv.style.display = 'none';
    }
}

// Remover campo
function removeField(fieldId) {
    const fieldDiv = document.querySelector(`[data-field-id="${fieldId}"]`);
    if (fieldDiv) {
        fieldDiv.remove();
        updateFieldNumbers();
    }
}

// Actualizar numeración de campos
function updateFieldNumbers() {
    const fieldItems = document.querySelectorAll('.field-item');
    fieldItems.forEach((item, index) => {
        const fieldNumber = item.querySelector('.field-number');
        const fieldTitle = item.querySelector('.field-header span:last-child');
        
        if (fieldNumber && fieldTitle) {
            fieldNumber.textContent = index + 1;
            fieldTitle.textContent = `Campo ${index + 1}`;
        }
    });
}

// Manejar creación/edición de tabla
async function handleCreateTable(e) {
    e.preventDefault();
    
    const submitBtn = document.querySelector('#create-table-form button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = editingTableId ? 'Actualizando...' : 'Creando...';
        
        const formData = new FormData(e.target);
        const tableData = extractTableData(formData);
        
        // Agregar clientId para nuevas tablas
        if (!editingTableId) {
            tableData.clientId = currentClientId;
        }
        
        // Validar datos
        if (!validateTableData(tableData)) {
            return;
        }
        
        const token = localStorage.getItem('token');
        let url, method;
        
        if (editingTableId) {
            url = `/api/custom-tables/${editingTableId}`;
            method = 'PUT';
            // Remover campos no editables
            delete tableData.clientId;
            delete tableData.collectionName;
        } else {
            url = '/api/custom-tables';
            method = 'POST';
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify(tableData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Error al guardar la tabla');
        }
        
        const message = editingTableId 
            ? `Tabla "${tableData.tableName}" actualizada correctamente`
            : `Tabla "${tableData.tableName}" creada correctamente. Colección: ${result.collectionName}`;
            
        showSuccess(message);
        
        // Cerrar modal y recargar tablas
        document.getElementById('table-modal').style.display = 'none';
        await loadClientTables();
        
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        editingTableId = null;
    }
}

// Extraer datos del formulario
function extractTableData(formData) {
    const tableName = formData.get('tableName');
    const collectionName = formData.get('collectionName');
    const description = formData.get('description');
    
    const fields = [];
    const fieldItems = document.querySelectorAll('.field-item');
    
    fieldItems.forEach((item) => {
        const fieldId = item.dataset.fieldId;
        
        const field = {
            name: formData.get(`field_name_${fieldId}`),
            label: formData.get(`field_label_${fieldId}`),
            type: formData.get(`field_type_${fieldId}`),
            placeholder: formData.get(`field_placeholder_${fieldId}`) || '',
            required: formData.has(`field_required_${fieldId}`)
        };
        
        // Opciones para campos select
        if (field.type === 'select') {
            const optionsText = formData.get(`field_options_${fieldId}`) || '';
            field.options = optionsText.split('\n')
                .map(opt => opt.trim())
                .filter(opt => opt.length > 0);
        }
        
        // Validaciones
        const min = formData.get(`field_min_${fieldId}`);
        const max = formData.get(`field_max_${fieldId}`);
        
        if (min || max) {
            field.validation = {};
            if (min) {
                if (field.type === 'number') {
                    field.validation.min = parseFloat(min);
                } else {
                    field.validation.minLength = parseInt(min);
                }
            }
            if (max) {
                if (field.type === 'number') {
                    field.validation.max = parseFloat(max);
                } else {
                    field.validation.maxLength = parseInt(max);
                }
            }
        }
        
        fields.push(field);
    });
    
    return {
        tableName,
        collectionName,
        description,
        fields
    };
}

// Validar datos de la tabla
function validateTableData(tableData) {
    if (!tableData.tableName.trim()) {
        showError('El nombre de la tabla es requerido');
        return false;
    }
    
    if (!editingTableId && !tableData.collectionName.trim()) {
        showError('El nombre de la colección es requerido');
        return false;
    }
    
    if (tableData.fields.length === 0) {
        showError('Debe definir al menos un campo');
        return false;
    }
    
    // Validar campos únicos
    const fieldNames = tableData.fields.map(f => f.name.toLowerCase());
    const uniqueNames = new Set(fieldNames);
    if (fieldNames.length !== uniqueNames.size) {
        showError('Los nombres de los campos deben ser únicos');
        return false;
    }
    
    // Validar campos select con opciones
    for (const field of tableData.fields) {
        if (field.type === 'select' && (!field.options || field.options.length === 0)) {
            showError(`El campo "${field.label}" de tipo lista debe tener al menos una opción`);
            return false;
        }
    }
    
    return true;
}

// Ver datos de una tabla
function viewTableData(tableId) {
    window.location.href = `/table-data.html?tableId=${tableId}`;
}

// Editar tabla
async function editTable(tableId) {
    try {
        const table = currentTables.find(t => t._id === tableId);
        if (!table) {
            showError('Tabla no encontrada');
            return;
        }
        
        editingTableId = tableId;
        
        // Abrir modal en modo edición
        const modal = document.getElementById('table-modal');
        const modalTitle = document.getElementById('table-modal-title');
        
        modalTitle.textContent = 'Editar Tabla Personalizada';
        
        // Llenar formulario con datos existentes
        document.getElementById('table-name').value = table.tableName;
        document.getElementById('table-collection-name').value = table.collectionName;
        document.getElementById('table-description').value = table.description || '';
        
        // Deshabilitar cambio de colección en edición
        document.getElementById('table-collection-name').disabled = true;
        
        // Limpiar campos y recrear
        const fieldsContainer = document.getElementById('fields-container');
        fieldsContainer.innerHTML = '';
        fieldCounter = 0;
        
        // Recrear campos existentes
        table.fields.forEach(field => {
            addField();
            fillFieldData(fieldCounter, field);
        });
        
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error preparando edición:', error);
        showError('Error al preparar la edición de la tabla');
    }
}

// Llenar datos de un campo en edición
function fillFieldData(fieldId, fieldData) {
    document.querySelector(`input[name="field_name_${fieldId}"]`).value = fieldData.name;
    document.querySelector(`input[name="field_label_${fieldId}"]`).value = fieldData.label;
    document.querySelector(`select[name="field_type_${fieldId}"]`).value = fieldData.type;
    document.querySelector(`input[name="field_placeholder_${fieldId}"]`).value = fieldData.placeholder || '';
    
    if (fieldData.required) {
        document.querySelector(`input[name="field_required_${fieldId}"]`).checked = true;
    }
    
    if (fieldData.options && fieldData.options.length > 0) {
        document.querySelector(`textarea[name="field_options_${fieldId}"]`).value = fieldData.options.join('\n');
    }
    
    if (fieldData.validation) {
        if (fieldData.validation.min !== undefined || fieldData.validation.minLength !== undefined) {
            const minValue = fieldData.validation.min !== undefined ? fieldData.validation.min : fieldData.validation.minLength;
            document.querySelector(`input[name="field_min_${fieldId}"]`).value = minValue;
        }
        if (fieldData.validation.max !== undefined || fieldData.validation.maxLength !== undefined) {
            const maxValue = fieldData.validation.max !== undefined ? fieldData.validation.max : fieldData.validation.maxLength;
            document.querySelector(`input[name="field_max_${fieldId}"]`).value = maxValue;
        }
    }
    
    // Trigger para mostrar opciones correctas
    handleFieldTypeChange(fieldId, fieldData.type);
}

// Eliminar tabla
function deleteTable(tableId) {
    const table = currentTables.find(t => t._id === tableId);
    if (!table) {
        showError('Tabla no encontrada');
        return;
    }
    
    // Mostrar modal de confirmación
    document.getElementById('delete-confirmation-text').textContent = 
        `¿Está seguro que desea eliminar la tabla "${table.tableName}"? Esta acción no se puede deshacer.`;
    
    document.getElementById('delete-confirm').setAttribute('data-table-id', tableId);
    document.getElementById('confirm-delete-modal').style.display = 'block';
}

// Confirmar eliminación de tabla
async function confirmDeleteTable() {
    const tableId = document.getElementById('delete-confirm').getAttribute('data-table-id');
    
    if (!tableId) return;
    
    try {
        const deleteBtn = document.getElementById('delete-confirm');
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Eliminando...';
        
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/custom-tables/${tableId}`, {
            method: 'DELETE',
            headers: {
                'x-auth-token': token
            }
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Error al eliminar la tabla');
        }
        
        showSuccess('Tabla eliminada correctamente');
        document.getElementById('confirm-delete-modal').style.display = 'none';
        await loadClientTables();
        
    } catch (error) {
        console.error('Error eliminando tabla:', error);
        showError(error.message);
    } finally {
        const deleteBtn = document.getElementById('delete-confirm');
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Eliminar';
    }
}

// Funciones de UI
function showLoading() {
    document.getElementById('loading-container').style.display = 'block';
    document.getElementById('tables-content').style.display = 'none';
    document.getElementById('error-container').style.display = 'none';
}

function showContent() {
    document.getElementById('loading-container').style.display = 'none';
    document.getElementById('tables-content').style.display = 'block';
    document.getElementById('error-container').style.display = 'none';
}

function showError(message) {
    document.getElementById('loading-container').style.display = 'none';
    document.getElementById('tables-content').style.display = 'none';
    document.getElementById('error-container').style.display = 'block';
    document.getElementById('error-message').textContent = message;
}

function showSuccess(message) {
    // Crear o actualizar el elemento de mensaje de éxito
    let messageEl = document.getElementById('success-message');
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.id = 'success-message';
        messageEl.className = 'success-message';
        messageEl.style.cssText = `
            background-color: rgba(46, 204, 113, 0.1);
            color: #27ae60;
            border: 1px solid rgba(46, 204, 113, 0.3);
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1rem;
            text-align: center;
        `;
        document.querySelector('.custom-tables-container').prepend(messageEl);
    }
    
    messageEl.textContent = message;
    messageEl.style.display = 'block';
    
    // Ocultar después de 5 segundos
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

// Funciones globales para que sean accesibles desde HTML
window.viewTableData = viewTableData;
window.editTable = editTable;
window.deleteTable = deleteTable;
window.removeField = removeField;
window.handleFieldTypeChange = handleFieldTypeChange;