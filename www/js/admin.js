document.addEventListener("DOMContentLoaded", () => {
    // Observador Ninja: Vigila constantemente la pantalla. 
    // Si aparece el contenedor de administrador, verifica si el usuario tiene permiso.
    const appContent = document.getElementById('app-content');
    if (appContent) {
        const observer = new MutationObserver(() => {
            const adminContainer = document.getElementById('admin-panel-container');
            if (adminContainer && !document.getElementById('btn-admin-usuarios')) {
                verificarYMostrarBotonAdmin(adminContainer);
            }
        });
        observer.observe(appContent, { childList: true, subtree: true });
    }
});

// Función para comprobar si eres Kenth o LTHiking
function verificarYMostrarBotonAdmin(container) {
    let pinStr = null;
    
    // Intentamos extraer el PIN de la sesión activa
    try {
        const usuarioData = JSON.parse(localStorage.getItem('usuario') || localStorage.getItem('usuarioActivo') || '{}');
        pinStr = usuarioData.pin || localStorage.getItem('pin') || localStorage.getItem('usuario_pin');
    } catch(e) {}

    // Los PINs maestros declarados en tu app.py
    if (pinStr === '00000000' || pinStr === '88888888') {
        container.innerHTML = `
            <div class="card border-0 shadow-sm mt-4 mb-4 bg-light border border-danger border-opacity-25">
                <div class="card-body text-center p-4">
                    <h6 class="fw-bold text-danger mb-3">
                        <i class="bi bi-shield-lock-fill fs-4 d-block mb-1"></i> Panel de Superusuario
                    </h6>
                    <button id="btn-admin-usuarios" class="btn btn-danger w-100 rounded-pill fw-bold shadow-sm" onclick="abrirVistaUsuarios()">
                        <i class="bi bi-person-lines-fill me-1"></i> Ver Lista de Registrados
                    </button>
                </div>
            </div>
        `;
    }
}

// Navegar a la vista
function abrirVistaUsuarios() {
    // Intentamos cargar la vista como un documento normal (SPA simple)
    fetch('usuarios.html')
        .then(res => res.text())
        .then(html => {
            document.getElementById('app-content').innerHTML = html;
            // Ejecutamos los scripts inyectados manualmente
            cargarListaUsuariosAPI();
        })
        .catch(err => alert("Error cargando la vista de usuarios."));
}

// Conectar con PythonAnywhere y armar la tabla
async function cargarListaUsuariosAPI() {
    const tbody = document.getElementById('tabla-usuarios-body');
    if (!tbody) return;

    try {
        // Usamos la variable API_URL global de tu api_db.js
        const res = await fetch(`${API_URL}/admin/usuarios`);
        const data = await res.json();

        if (data.status === 'ok') {
            tbody.innerHTML = ''; // Limpiamos el spinner
            
            data.usuarios.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="text-center"><span class="badge bg-secondary rounded-circle">${u.consecutivo}</span></td>
                    <td>
                        <span class="fw-bold d-block text-dark">${u.nombre}</span>
                        <small class="text-muted">${u.apellido1}</small>
                    </td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-success rounded-pill px-3 fw-bold shadow-sm" onclick="iniciarChatDesdeAdmin('${u.pin}', '${u.nombre}')">
                            <i class="bi bi-whatsapp"></i> ${u.pin}
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-4">Error: ${data.error}</td></tr>`;
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-4"><i class="bi bi-wifi-off"></i> Error de conexión con el servidor</td></tr>`;
        console.error("Error al cargar usuarios:", error);
    }
}

// Disparador del Chat
window.iniciarChatDesdeAdmin = function(pin, nombre) {
    // 1. Abrimos el modal flotante del chat (ya lo tienes en tu HTML)
    if (typeof window.abrirModalChat === 'function') {
        window.abrirModalChat();
        
        // 2. Si tu chat está diseñado para abrir contactos específicos, lo enlazamos.
        // Si no tienes una función aún, el usuario abrirá el chat y buscará al usuario en la lista manualmente.
        if (typeof window.seleccionarContacto === 'function') {
            setTimeout(() => window.seleccionarContacto(pin, nombre), 350);
        } else {
            console.log(`Preparando chat con ${nombre} (${pin})`);
        }
    } else {
        alert(`Usa el botón de chat amarillo para hablar con ${nombre} (${pin})`);
    }
};