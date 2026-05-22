/**
 * Efectos de UI para mejorar la experiencia del usuario
 */
document.addEventListener('DOMContentLoaded', function() {
    // Efecto de ripple para botones
    const buttons = document.querySelectorAll('.primary-btn, .secondary-btn');
    
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const x = e.clientX - e.target.getBoundingClientRect().left;
            const y = e.clientY - e.target.getBoundingClientRect().top;
            
            const ripple = document.createElement('span');
            ripple.classList.add('ripple-effect');
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
    
    // Animación de entrada para elementos de lista
    const animateItems = () => {
        const items = document.querySelectorAll('.chat-item, .admin-table tr');
        items.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            
            setTimeout(() => {
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, 50 * index);
        });
    };
    
    // Ejecutar la animación cuando se carguen las listas
    if (document.getElementById('chats-container')) {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    animateItems();
                    break;
                }
            }
        });
        
        observer.observe(document.getElementById('chats-container'), { childList: true });
    }
    
    if (document.getElementById('users-list')) {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    animateItems();
                    break;
                }
            }
        });
        
        observer.observe(document.getElementById('users-list'), { childList: true });
    }
    
    // Mejorar la experiencia de los formularios
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        // Añadir clase activa cuando el input tiene contenido
        input.addEventListener('blur', function() {
            if (this.value) {
                this.classList.add('has-content');
            } else {
                this.classList.remove('has-content');
            }
        });
        
        // Comprobar contenido inicial
        if (input.value) {
            input.classList.add('has-content');
        }
    });
    
    // Efecto de carga en botones de envío
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function() {
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.classList.add('loading');
                submitBtn.disabled = true;
                
                // Restaurar después de un tiempo en caso de error
                setTimeout(() => {
                    submitBtn.classList.remove('loading');
                    submitBtn.disabled = false;
                }, 5000);
            }
        });
    });
});

// Agregar los estilos necesarios para los efectos
const styleElement = document.createElement('style');
styleElement.textContent = `
.ripple-effect {
    position: absolute;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    transform: scale(0);
    animation: ripple 0.6s linear;
    pointer-events: none;
}

@keyframes ripple {
    to {
        transform: scale(4);
        opacity: 0;
    }
}

input.has-content {
    border-color: #128C7E;
}

.btn {
    position: relative;
    overflow: hidden;
}
`;

document.head.appendChild(styleElement);
