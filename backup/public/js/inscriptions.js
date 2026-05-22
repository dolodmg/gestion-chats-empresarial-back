document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticación
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token) {
        window.location.href = '/';
        return;
    }

    // Verificar acceso a inscripciones
    if (user.clientId !== '577642088768581' && user.role !== 'admin') {
        alert('No tienes acceso a esta funcionalidad');
        window.location.href = '/';
        return;
    }

    // Variables globales
    let currentPage = 1;
    let currentFilters = {};
    let inscriptionToDelete = null;
    let availableCourses = [];

    // Elementos del DOM
    const loadingContainer = document.getElementById('loading-container');
    const inscriptionsContent = document.getElementById('inscriptions-content');
    const errorContainer = document.getElementById('error-container');
    const noInscriptionsContainer = document.getElementById('no-inscriptions');
    const inscriptionsList = document.getElementById('inscriptions-list');
    const totalInscriptionsEl = document.getElementById('total-inscriptions');
    const paginationEl = document.getElementById('pagination');
    const dniSearchInput = document.getElementById('dni-search');
    const provinciaFilterSelect = document.getElementById('provincia-filter');
    const cursoFilterSelect = document.getElementById('curso-filter'); // NUEVO
    const deleteModal = document.getElementById('delete-modal');
    const exportModal = document.getElementById('export-modal'); // NUEVO

    // Manejadores de eventos básicos
    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.href = '/';
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('selectedChatId');
        window.location.href = '/';
    });

    document.getElementById('retry-btn').addEventListener('click', loadInscriptions);

    // Búsqueda por DNI con debounce
    let searchTimeout;
    dniSearchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentFilters.dni = this.value.trim();
            currentPage = 1;
            loadInscriptions();
        }, 500);
    });

    // Filtro por provincia
    provinciaFilterSelect.addEventListener('change', function() {
        currentFilters.provincia = this.value;
        currentPage = 1;
        loadInscriptions();
    });

    // NUEVO: Filtro por curso
    cursoFilterSelect.addEventListener('change', function() {
        currentFilters.curso = this.value;
        currentPage = 1;
        loadInscriptions();
    });

    // Limpiar filtros
    document.getElementById('clear-filters').addEventListener('click', function() {
        dniSearchInput.value = '';
        provinciaFilterSelect.value = 'todas';
        cursoFilterSelect.value = 'todos'; // NUEVO
        currentFilters = {};
        currentPage = 1;
        loadInscriptions();
    });

    // NUEVO: Modal de exportación
    document.getElementById('export-csv').addEventListener('click', showExportModal);
    document.getElementById('export-cancel').addEventListener('click', function() {
        exportModal.style.display = 'none';
    });
    document.getElementById('export-confirm').addEventListener('click', exportToCSV);

    // Modal de eliminación
    document.getElementById('delete-cancel').addEventListener('click', function() {
        deleteModal.style.display = 'none';
        inscriptionToDelete = null;
    });

    document.getElementById('delete-confirm').addEventListener('click', deleteInscription);

    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', function(e) {
        if (e.target === deleteModal) {
            deleteModal.style.display = 'none';
            inscriptionToDelete = null;
        }
        if (e.target === exportModal) {
            exportModal.style.display = 'none';
        }
    });

    // NUEVO: Cargar cursos disponibles
    async function loadCourses() {
        try {
            const response = await fetch('/api/inscriptions/courses', {
                method: 'GET',
                headers: {
                    'x-auth-token': token
                }
            });

            const data = await response.json();

            if (response.ok && data.courses) {
                availableCourses = data.courses;
                populateCourseFilter();
            }
        } catch (error) {
            console.error('Error cargando cursos:', error);
        }
    }

    // NUEVO: Poblar el filtro de cursos
    function populateCourseFilter() {
        // Limpiar opciones existentes excepto la primera
        cursoFilterSelect.innerHTML = '<option value="todos">Todos los cursos</option>';
        
        availableCourses.forEach(course => {
            const option = document.createElement('option');
            option.value = course.normalizedName; // Usar normalizedName para el filtrado
            option.textContent = `${course.name} (${course.count})`;
            cursoFilterSelect.appendChild(option);
        });
    }

    // NUEVO: Mostrar modal de exportación
    async function showExportModal() {
        try {
            // Obtener el conteo actual con los filtros aplicados
            const params = new URLSearchParams({
                page: 1,
                limit: 1, // Solo necesitamos el conteo
                ...currentFilters
            });

            const response = await fetch(`/api/inscriptions?${params}`, {
                method: 'GET',
                headers: {
                    'x-auth-token': token
                }
            });

            const data = await response.json();
            const totalToExport = data.pagination ? data.pagination.total : 0;

            // Actualizar el contenido del modal
            let message = `Se exportarán ${totalToExport} inscripciones`;
            if (totalToExport === 0) {
                message = 'No hay inscripciones para exportar con los filtros actuales';
            }

            document.getElementById('export-message').textContent = message;

            // Mostrar resumen de filtros aplicados
            const exportSummary = document.getElementById('export-summary');
            let summaryHTML = '<h4>Filtros aplicados:</h4><ul>';

            if (currentFilters.dni) {
                summaryHTML += `<li><strong>DNI:</strong> ${currentFilters.dni}</li>`;
            }
            if (currentFilters.provincia && currentFilters.provincia !== 'todas') {
                summaryHTML += `<li><strong>Provincia:</strong> ${currentFilters.provincia}</li>`;
            }
            if (currentFilters.curso && currentFilters.curso !== 'todos') {
                summaryHTML += `<li><strong>Curso:</strong> ${currentFilters.curso}</li>`;
            }

            if (!currentFilters.dni && (!currentFilters.provincia || currentFilters.provincia === 'todas') && (!currentFilters.curso || currentFilters.curso === 'todos')) {
                summaryHTML += '<li><em>Ningún filtro aplicado (todas las inscripciones)</em></li>';
            }

            summaryHTML += '</ul>';
            exportSummary.innerHTML = summaryHTML;

            // Deshabilitar botón de exportar si no hay datos
            const exportBtn = document.getElementById('export-confirm');
            exportBtn.disabled = totalToExport === 0;

            exportModal.style.display = 'block';

        } catch (error) {
            console.error('Error preparando exportación:', error);
            alert('Error al preparar la exportación: ' + error.message);
        }
    }

    // NUEVO: Exportar a CSV
    async function exportToCSV() {
        try {
            const exportBtn = document.getElementById('export-confirm');
            const originalContent = exportBtn.innerHTML;
            
            // Cambiar botón a estado de carga
            exportBtn.disabled = true;
            exportBtn.innerHTML = '<span class="export-loading"></span>Exportando...';

            const params = new URLSearchParams(currentFilters);

            const response = await fetch(`/api/inscriptions/export/csv?${params}`, {
                method: 'GET',
                headers: {
                    'x-auth-token': token
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al exportar CSV');
            }

            // Obtener el blob del archivo CSV
            const blob = await response.blob();
            
            // Obtener el nombre del archivo de los headers
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'inscripciones.csv';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }

            // Crear link de descarga
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Cerrar modal
            exportModal.style.display = 'none';

        } catch (error) {
            console.error('Error exportando CSV:', error);
            alert(`Error al exportar: ${error.message}`);
        } finally {
            // Restaurar botón
            const exportBtn = document.getElementById('export-confirm');
            exportBtn.disabled = false;
            exportBtn.innerHTML = '<span class="export-icon">📊</span>Exportar';
        }
    }

    // Función principal para cargar inscripciones
    async function loadInscriptions() {
        try {
            showLoading();

            const params = new URLSearchParams({
                page: currentPage,
                limit: 20,
                ...currentFilters
            });

            const response = await fetch(`/api/inscriptions?${params}`, {
                method: 'GET',
                headers: {
                    'x-auth-token': token
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al cargar las inscripciones');
            }

            if (data.inscriptions && data.inscriptions.length > 0) {
                displayInscriptions(data.inscriptions);
                generatePagination(data.pagination);
                updateStats(data.pagination.total);
                showContent();
            } else {
                showNoInscriptions();
            }

        } catch (error) {
            console.error('Error:', error);
            showError(error.message);
        }
    }

    // Mostrar inscripciones en la tabla
    function displayInscriptions(inscriptions) {
        inscriptionsList.innerHTML = '';

        inscriptions.forEach(inscription => {
            const row = document.createElement('tr');
            
            const fecha = new Date(inscription.createdAt).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            // Determinar qué mostrar en la columna de provincia/estado
            let provinciaDisplay = '';
            if (inscription.provincia === 'otros' && inscription.provinciaOriginal) {
                // Mostrar el dato original que escribió el usuario (ej: "Jalisco", "São Paulo")
                provinciaDisplay = inscription.provinciaOriginal;
            } else {
                // Mostrar provincia argentina normalizada
                provinciaDisplay = capitalizeFirstLetter(inscription.provincia);
            }

            row.innerHTML = `
                <td>${inscription.dni}</td>
                <td>${inscription.nombreCompleto}</td>
                <td>${inscription.curso}</td>
                <td>${inscription.correo}</td>
                <td>${provinciaDisplay}</td>
                <td>${inscription.localidad}</td>
                <td>${inscription.codigoPostal}</td>
                <td>${fecha}</td>
                <td class="actions-column">
                    <button class="delete-btn" data-id="${inscription._id}" data-name="${inscription.nombreCompleto}">
                        Eliminar
                    </button>
                </td>
            `;

            // Agregar clase especial para inscripciones extranjeras (opcional, para styling)
            if (inscription.provincia === 'otros') {
                row.classList.add('foreign-inscription');
            }

            inscriptionsList.appendChild(row);
        });

        // Agregar event listeners a los botones de eliminar
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                const name = this.getAttribute('data-name');
                showDeleteModal(id, name);
            });
        });
    }

    // Generar paginación
    function generatePagination(pagination) {
        paginationEl.innerHTML = '';

        if (pagination.totalPages <= 1) return;

        const { page, totalPages } = pagination;

        // Botón anterior
        if (page > 1) {
            const prevBtn = createPaginationButton('Anterior', page - 1);
            paginationEl.appendChild(prevBtn);
        }

        // Números de página
        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(totalPages, page + 2);

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = createPaginationButton(i, i, i === page);
            paginationEl.appendChild(pageBtn);
        }

        // Botón siguiente
        if (page < totalPages) {
            const nextBtn = createPaginationButton('Siguiente', page + 1);
            paginationEl.appendChild(nextBtn);
        }
    }

    // Crear botón de paginación
    function createPaginationButton(text, targetPage, isActive = false) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = isActive ? 'active' : '';
        button.addEventListener('click', () => {
            currentPage = targetPage;
            loadInscriptions();
        });
        return button;
    }

    // Mostrar modal de eliminación
    function showDeleteModal(id, name) {
        inscriptionToDelete = id;
        deleteModal.querySelector('h3').textContent = `¿Eliminar la inscripción de ${name}?`;
        deleteModal.style.display = 'block';
    }

    // Eliminar inscripción
    async function deleteInscription() {
        if (!inscriptionToDelete) return;

        try {
            const deleteBtn = document.getElementById('delete-confirm');
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Eliminando...';

            const response = await fetch(`/api/inscriptions/${inscriptionToDelete}`, {
                method: 'DELETE',
                headers: {
                    'x-auth-token': token
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al eliminar la inscripción');
            }

            // Cerrar modal
            deleteModal.style.display = 'none';
            inscriptionToDelete = null;

            // Recargar inscripciones
            loadInscriptions();

        } catch (error) {
            console.error('Error:', error);
            alert(`Error: ${error.message}`);
        } finally {
            const deleteBtn = document.getElementById('delete-confirm');
            deleteBtn.disabled = false;
            deleteBtn.textContent = 'Eliminar';
        }
    }

    // Actualizar estadísticas
    function updateStats(total) {
        totalInscriptionsEl.textContent = total;
    }

    // Capitalizar primera letra
    function capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // Funciones de UI
    function showLoading() {
        loadingContainer.style.display = 'block';
        inscriptionsContent.style.display = 'none';
        errorContainer.style.display = 'none';
        noInscriptionsContainer.style.display = 'none';
    }

    function showContent() {
        loadingContainer.style.display = 'none';
        inscriptionsContent.style.display = 'block';
        errorContainer.style.display = 'none';
        noInscriptionsContainer.style.display = 'none';
    }

    function showError(message) {
        loadingContainer.style.display = 'none';
        inscriptionsContent.style.display = 'none';
        errorContainer.style.display = 'block';
        noInscriptionsContainer.style.display = 'none';
        
        document.getElementById('error-message').textContent = message;
    }

    function showNoInscriptions() {
        loadingContainer.style.display = 'none';
        inscriptionsContent.style.display = 'none';
        errorContainer.style.display = 'none';
        noInscriptionsContainer.style.display = 'block';
        
        updateStats(0);
    }

    // NUEVO: Inicializar la aplicación
    async function initializeApp() {
        await loadCourses(); // Cargar cursos primero
        loadInscriptions(); // Luego cargar inscripciones
    }

    // Inicializar la aplicación
    initializeApp();
});