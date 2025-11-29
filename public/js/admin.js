document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticación y rol de administrador
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token || user.role !== 'admin') {
        window.location.href = '/';
        return;
    }

    // Mostrar nombre de usuario
    document.getElementById('user-name').textContent = user.name || 'Administrador';

    // Cargar la lista de usuarios
    loadUsers();

    // Cambio de pestañas
    document.querySelectorAll('.admin-menu li').forEach(item => {
        item.addEventListener('click', function() {
            // Actualizar menú
            document.querySelectorAll('.admin-menu li').forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            // Mostrar tab correspondiente
            const tabId = this.getAttribute('data-tab');
            document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // Manejar botón volver
    document.getElementById('back-btn').addEventListener('click', function() {
        window.location.href = '/index.html';
    });

    // Manejar cerrar sesión
    document.getElementById('logout-btn').addEventListener('click', function() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('selectedChatId');
        window.location.href = '/';
    });

    // Manejar apertura del modal para agregar usuario
    document.getElementById('add-user-btn').addEventListener('click', function() {
        openUserModal();
    });

    // Cambiar visibilidad del campo client-id según el rol
    document.getElementById('user-role').addEventListener('change', function() {
        const clientIdContainer = document.getElementById('client-id-container');
        const workflowIdContainer = document.getElementById('workflow-id-container');
        
        if (this.value === 'admin') {
            clientIdContainer.style.display = 'none';
            workflowIdContainer.style.display = 'none';
            document.getElementById('client-id').removeAttribute('required');
            document.getElementById('workflow-id').removeAttribute('required');
        } else {
            clientIdContainer.style.display = 'block';
            workflowIdContainer.style.display = 'block';
            document.getElementById('client-id').setAttribute('required', 'required');
            // workflow-id no es requerido, es opcional
        }
    });

    // Manejar cierre del modal
    document.querySelector('.modal-close').addEventListener('click', function() {
        document.getElementById('user-modal').style.display = 'none';
    });

    // Cerrar modal al hacer clic fuera de él
    window.addEventListener('click', function(e) {
        if (e.target === document.getElementById('user-modal')) {
            document.getElementById('user-modal').style.display = 'none';
        }
        if (e.target === document.getElementById('confirm-modal')) {
            document.getElementById('confirm-modal').style.display = 'none';
        }
    });

    // Manejar envío del formulario de usuario
    document.getElementById('user-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const userId = document.getElementById('user-id').value;
    const name = document.getElementById('user-name-input').value;
    const email = document.getElementById('user-email').value;
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    let clientId = null;
    let workflowId = null;
    let whatsappToken = null;

    if (role === 'client') {
        clientId = document.getElementById('client-id').value;
        workflowId = document.getElementById('workflow-id').value || null;
        whatsappToken = document.getElementById('whatsapp-token').value;
        
        if (!clientId) {
            alert('El campo Client ID es requerido para usuarios de tipo cliente');
            return;
        }
        if (!whatsappToken && !userId) {
            alert('El token de WhatsApp es requerido para nuevos usuarios');
            return;
        }
    }

    try {
        let response;
        const requestBody = { name, email, role, clientId, workflowId };
        
        // Solo incluir password y whatsappToken si se proporcionaron
        if (password) requestBody.password = password;
        if (whatsappToken) requestBody.whatsappToken = whatsappToken;

        if (userId) {
            // Actualizar usuario existente
            response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify(requestBody)
            });
        } else {
            // Crear nuevo usuario
            response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify(requestBody)
            });
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.msg || 'Error al guardar el usuario');
        }

        // Cerrar modal y recargar lista de usuarios
        document.getElementById('user-modal').style.display = 'none';
        loadUsers();

    } catch (error) {
        alert(error.message);
    }
});

    // Manejar botones de cancelar y confirmar eliminación
    document.getElementById('confirm-cancel').addEventListener('click', function() {
        document.getElementById('confirm-modal').style.display = 'none';
    });

    document.getElementById('confirm-delete').addEventListener('click', async function() {
        const userId = this.getAttribute('data-user-id');

        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'x-auth-token': token
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.msg || 'Error al eliminar el usuario');
            }

            // Cerrar modal y recargar lista de usuarios
            document.getElementById('confirm-modal').style.display = 'none';
            loadUsers();

        } catch (error) {
            alert(error.message);
        }
    });
});

// Función para cargar usuarios
async function loadUsers() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users', {
            method: 'GET',
            headers: {
                'x-auth-token': token
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar usuarios');
        }

        const users = await response.json();
        displayUsers(users);

    } catch (error) {
        console.error('Error:', error);
    }
}

// Función para mostrar usuarios en la tabla
function displayUsers(users) {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';

    users.forEach(user => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role === 'admin' ? 'Administrador' : 'Cliente'}</td>
            <td>${user.clientId || '-'}</td>
            <td>${user.workflowId || '-'}</td>
            <td>${user.whatsappToken ? '***configurado***' : 'No configurado'}</td>
            <td class="action-buttons">
                <button class="edit-btn" data-user-id="${user._id}">Editar</button>
                ${user.role === 'client' ? `<button class="tables-btn" data-client-id="${user.clientId}" data-user-name="${user.name}">Tablas</button>` : ''}
                <button class="delete-btn" data-user-id="${user._id}">Eliminar</button>
            </td>
        `;

        usersList.appendChild(row);
    });

    // Event listeners para botones...
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            const user = users.find(u => u._id === userId);
            if (user) {
                openUserModal(user);
            }
        });
    });

    // Event listeners para botones de tablas
    document.querySelectorAll('.tables-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const clientId = this.getAttribute('data-client-id');
            const userName = this.getAttribute('data-user-name');
            window.location.href = `/table-management.html?clientId=${clientId}&userName=${userName}`;
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            openConfirmModal(userId);
        });
    });
}


// Función para abrir el modal de usuario (para crear o editar)
function openUserModal(user = null) {
    const modal = document.getElementById('user-modal');
    const form = document.getElementById('user-form');
    const modalTitle = document.getElementById('modal-title');
    const userIdInput = document.getElementById('user-id');
    const nameInput = document.getElementById('user-name-input');
    const emailInput = document.getElementById('user-email');
    const passwordInput = document.getElementById('user-password');
    const roleSelect = document.getElementById('user-role');
    const clientIdInput = document.getElementById('client-id');
    const workflowIdInput = document.getElementById('workflow-id');
    const whatsappTokenInput = document.getElementById('whatsapp-token');
    const clientIdContainer = document.getElementById('client-id-container');
    const workflowIdContainer = document.getElementById('workflow-id-container');
    const whatsappTokenContainer = document.getElementById('whatsapp-token-container');

    // Resetear formulario
    form.reset();

    if (user) {
        // Modo edición
        modalTitle.textContent = 'Editar Usuario';
        userIdInput.value = user._id;
        nameInput.value = user.name;
        emailInput.value = user.email;

        // Al editar, la contraseña es opcional
        passwordInput.removeAttribute('required');

        roleSelect.value = user.role;

        if (user.role === 'admin') {
            clientIdContainer.style.display = 'none';
            workflowIdContainer.style.display = 'none';
            whatsappTokenContainer.style.display = 'none';
            clientIdInput.removeAttribute('required');
            workflowIdInput.removeAttribute('required');
            whatsappTokenInput.removeAttribute('required');
        } else {
            clientIdContainer.style.display = 'block';
            workflowIdContainer.style.display = 'block';
            whatsappTokenContainer.style.display = 'block';
            clientIdInput.setAttribute('required', 'required');
            whatsappTokenInput.setAttribute('required', 'required');
            clientIdInput.value = user.clientId || '';
            workflowIdInput.value = user.workflowId || '';
            // No mostrar el token por seguridad, solo placeholder
            whatsappTokenInput.placeholder = user.whatsappToken ? 'Token configurado (dejar vacío para mantener)' : 'Ingresar token de WhatsApp';
        }
    } else {
        // Modo creación
        modalTitle.textContent = 'Agregar Usuario';
        userIdInput.value = '';

        // Al crear, la contraseña es requerida
        passwordInput.setAttribute('required', 'required');

        // Por defecto, mostrar campos de cliente
        roleSelect.value = 'client';
        clientIdContainer.style.display = 'block';
        workflowIdContainer.style.display = 'block';
        whatsappTokenContainer.style.display = 'block';
        clientIdInput.setAttribute('required', 'required');
        whatsappTokenInput.setAttribute('required', 'required');
    }

    // Mostrar modal
    modal.style.display = 'block';
}

// Función para abrir el modal de confirmación de eliminación
function openConfirmModal(userId) {
    const confirmModal = document.getElementById('confirm-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete');

    confirmDeleteBtn.setAttribute('data-user-id', userId);
    confirmModal.style.display = 'block';
}