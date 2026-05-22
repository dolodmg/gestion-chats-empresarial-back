document.addEventListener('DOMContentLoaded', function() {
    // Inicializar la funcionalidad del "ojito" para mostrar/ocultar contraseñas
    initPasswordToggles();
    
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (token && user) {
        // Show chats section if logged in
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('chats-section').classList.remove('hidden');
        document.getElementById('user-name').textContent = user.name || 'Usuario';
        
        // Si el usuario es administrador, mostrar botón de admin
        if (user.role === 'admin') {
            addAdminButton();
        }
        
        // Si el usuario tiene acceso a inscripciones, mostrar botón
        if (user.clientId === '577642088768581') {
            addInscriptionsButton();
        }

        addDataButton();
        
        // Load chats
        loadChats();
    }

    // Login form submission
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Limpiar mensaje de error anterior
        document.getElementById('login-error').textContent = '';
        document.getElementById('login-error').style.display = 'none';
        
        // Cambiar el estado del botón
        const originalBtnText = loginBtn.textContent;
        loginBtn.textContent = 'Iniciando sesión...';
        loginBtn.disabled = true;

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.msg || 'Error al iniciar sesión');
            }

            // Save token and user info
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Show chats section
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('chats-section').classList.remove('hidden');
            document.getElementById('user-name').textContent = data.user.name || 'Usuario';

            // Si el usuario es administrador, mostrar botón de admin
            if (data.user.role === 'admin') {
                addAdminButton();
            }

            // Si el usuario tiene acceso a inscripciones, mostrar botón
            if (data.user.clientId === '577642088768581') {
                addInscriptionsButton();
            }

            addDataButton();

            // Load chats
            loadChats();

        } catch (error) {
            const errorMsg = document.getElementById('login-error');
            errorMsg.textContent = error.message;
            errorMsg.style.display = 'block';
            
            // Limpiar el campo de contraseña para evitar el problema de validación
            document.getElementById('password').value = '';
        } finally {
            // Restaurar el botón a su estado original
            loginBtn.textContent = originalBtnText;
            loginBtn.disabled = false;
        }
    });

    // Profile button
    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
        profileBtn.addEventListener('click', function() {
            window.location.href = '/profile';
        });
    }
    
    // Assistant button - Nuevo botón para la configuración del asistente
    const assistantBtn = document.getElementById('assistant-btn');
    if (assistantBtn) {
        assistantBtn.addEventListener('click', function() {
            window.location.href = '/assistant';
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            // Clear local storage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('selectedChatId');

            // Show login section
            document.getElementById('chats-section').classList.add('hidden');
            document.getElementById('login-section').classList.remove('hidden');
        });
    }
});

// Función para inicializar los botones de mostrar/ocultar contraseña
function initPasswordToggles() {
    document.querySelectorAll('.password-toggle').forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            const eyeIcon = this.querySelector('.eye-icon');
            const eyeSlashIcon = this.querySelector('.eye-slash-icon');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                eyeIcon.style.display = 'none';
                eyeSlashIcon.style.display = 'block';
            } else {
                passwordInput.type = 'password';
                eyeIcon.style.display = 'block';
                eyeSlashIcon.style.display = 'none';
            }
        });
    });
}

// Función para añadir botón de admin
function addAdminButton() {
    // Verificar si el botón ya existe para evitar duplicados
    if (!document.querySelector('button.admin-btn')) {
        const adminBtn = document.createElement('button');
        adminBtn.classList.add('btn', 'secondary-btn', 'admin-btn');
        adminBtn.textContent = 'Administración';
        adminBtn.addEventListener('click', function() {
            window.location.href = '/admin';
        });

        // Insertar antes del botón de perfil
        const actions = document.querySelector('.actions');
        actions.insertBefore(adminBtn, document.getElementById('profile-btn'));
    }
}

function addDataButton() {
    // Verificar si el botón ya existe para evitar duplicados
    if (!document.querySelector('button.data-btn')) {
        const dataBtn = document.createElement('button');
        dataBtn.classList.add('btn', 'secondary-btn', 'data-btn');
        dataBtn.textContent = 'Mis Datos';
        dataBtn.addEventListener('click', function() {
            window.location.href = '/table-data';
        });

        // Insertar antes del botón de perfil
        const actions = document.querySelector('.actions');
        actions.insertBefore(dataBtn, document.getElementById('profile-btn'));
    }
}

// Función para añadir botón de inscripciones
function addInscriptionsButton() {
    // Verificar si el botón ya existe para evitar duplicados
    if (!document.querySelector('button.inscriptions-btn')) {
        const inscriptionsBtn = document.createElement('button');
        inscriptionsBtn.classList.add('btn', 'secondary-btn', 'inscriptions-btn');
        inscriptionsBtn.textContent = 'Inscripciones';
        inscriptionsBtn.addEventListener('click', function() {
            window.location.href = '/inscriptions';
        });

        // Insertar antes del botón de perfil
        const actions = document.querySelector('.actions');
        actions.insertBefore(inscriptionsBtn, document.getElementById('profile-btn'));
    }
}