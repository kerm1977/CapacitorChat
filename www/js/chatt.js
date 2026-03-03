// Archivo: chatt.js
/**
 * chatt.js - Lógica Universal del Chat para la App 'T'
 * Gestiona mensajería, estados en tiempo real, notificaciones y archivos multimedia.
 */

// URL de la API (Ajustada a tu entorno en PythonAnywhere)
const URL_BASE_T = (typeof API_URL !== 'undefined') ? API_URL : 'https://kenth1977.pythonanywhere.com/api/tribuAPP';
const CHATT_API = `${URL_BASE_T}/chatt`;

window.ChatManager = {
    chatActivoNombre: null,
    intervaloChat: null,
    intervaloGlobal: null,
    _lastChatHtml: "", // Cache para evitar parpadeos innecesarios

    // 1. GESTIÓN DE IDENTIDAD
    obtenerMiNombre() {
        // Soportar ambas variables por si tu Login lo guarda bajo otro nombre
        return localStorage.getItem('tribu_nombre') || localStorage.getItem('usuarioActual');
    },

    verificarIdentidad() {
        const nombre = this.obtenerMiNombre();
        if (!nombre) {
            console.warn("Identidad no encontrada en el almacenamiento local. El chat no funcionará.");
            return false;
        }
        return nombre;
    },

    // 2. COMUNICACIÓN CON EL SERVIDOR (FETCH SEGURO)
    async llamarAPI(endpoint, options = {}) {
        try {
            const respuesta = await fetch(`${CHATT_API}${endpoint}`, options);
            
            if (!respuesta.ok) {
                let errorMsg = `Error HTTP ${respuesta.status}`;
                try {
                    // Intentamos leer el error detallado del backend
                    const resClone = respuesta.clone();
                    try {
                        const errorData = await resClone.json();
                        if (errorData && errorData.error) errorMsg = errorData.error;
                    } catch (jsonErr) {
                        const errorText = await respuesta.text();
                        errorMsg = `Fallo del Servidor: ${errorText.substring(0, 100)}...`;
                    }
                } catch (e) {}
                throw new Error(errorMsg);
            }
            
            return await respuesta.json();
        } catch (error) {
            // Silenciamos errores de polling para no saturar la consola
            const esPolling = endpoint === '/contactos' || endpoint.includes('/heartbeat') || endpoint.includes('/unread_details') || endpoint === '/historial';
            
            if(!esPolling) {
                console.error(`[Chat T] Error en ${endpoint}:`, error);
                if (window.mostrarAlerta) {
                     window.mostrarAlerta("Error de servidor: " + error.message, "Fallo Crítico", "error");
                }
            }
            return { status: "error", error: error.message };
        }
    },

    // 3. TAREAS EN SEGUNDO PLANO (ESTADOS Y NOTIFICACIONES)
    iniciarPollingGlobal() {
        this.detenerPollingGlobal();
        this.ejecutarTareasGlobales(); 
        this.intervaloGlobal = setInterval(() => this.ejecutarTareasGlobales(), 5000); 
    },

    detenerPollingGlobal() {
        if (this.intervaloGlobal) clearInterval(this.intervaloGlobal);
    },

    async ejecutarTareasGlobales() {
        const miNombre = this.obtenerMiNombre();
        if (!miNombre) return;

        // Actualizar latido (Heartbeat) para salir en verde
        this.llamarAPI('/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: miNombre })
        });

        // Revisar mensajes no leídos para el badge rojo
        const resUnread = await this.llamarAPI(`/unread_details/${miNombre}`);
        let detallesNoLeidos = {};
        if (resUnread.status === 'ok') {
            detallesNoLeidos = resUnread.detalles;
            
            const totalUnread = Object.values(detallesNoLeidos).reduce((a, b) => a + b, 0);
            const badge = document.getElementById('chat-badge');
            if (badge) {
                if (totalUnread > 0) {
                    badge.textContent = totalUnread;
                    badge.classList.remove('d-none');
                } else {
                    badge.classList.add('d-none');
                }
            }
        }

        // Actualizar la lista de contactos (Principal y Modal)
        const resContactos = await this.llamarAPI('/contactos');
        if (resContactos.status === 'ok') {
            this.renderizarContactos(resContactos.contactos, miNombre, detallesNoLeidos);
        }
    },

    renderizarContactos(contactos, miNombre, unreadDetails) {
        const otrosUsuarios = contactos.filter(c => c.nombre !== miNombre);
        const listaMain = document.getElementById('main-contacts-list');
        const listaModal = document.getElementById('chat-contacts'); 

        if (otrosUsuarios.length === 0) {
            const htmlVacio = `
                <div class="p-5 text-center mt-3">
                    <i class="bi bi-person-check text-success mb-3" style="font-size: 4rem;"></i>
                    <h4 class="text-dark fw-bold mt-2">Estás Activo</h4>
                    <p class="small text-secondary mt-3">Aún no hay otros usuarios registrados en la tribu.</p>
                </div>`;
            if(listaMain) listaMain.innerHTML = htmlVacio;
            if(listaModal) listaModal.innerHTML = htmlVacio;
            return;
        }

        let html = '<div class="list-group list-group-flush">';
        for (const usr of otrosUsuarios) {
            const inicial = usr.nombre.charAt(0).toUpperCase();
            const esAdmin = (usr.rol === 'superadmin');
            const colorEstado = usr.online ? 'bg-success' : 'bg-danger';
            const textoEstado = usr.online ? 'En línea' : 'Desconectado';
            
            const countUnread = unreadDetails ? (unreadDetails[usr.nombre] || 0) : 0;
            const notificationBadge = countUnread > 0 
                ? `<span class="badge bg-danger rounded-pill shadow-sm ms-auto">${countUnread}</span>` 
                : '';

            html += `
            <button class="list-group-item list-group-item-action d-flex align-items-center p-3 border-bottom border-light" onclick="window.abrirChatDirecto('${usr.nombre}')">
                <div class="position-relative me-3">
                    <div class="${esAdmin ? 'bg-warning text-dark' : 'bg-secondary text-white'} rounded-circle d-flex justify-content-center align-items-center shadow-sm" style="width: 50px; height: 50px; font-size: 1.4rem; font-weight: bold;">
                        ${inicial}
                    </div>
                    <span class="position-absolute bottom-0 end-0 p-1 border border-2 border-white rounded-circle ${colorEstado}"></span>
                </div>
                <div class="flex-grow-1 text-start">
                    <div class="fw-bold text-dark text-truncate fs-6" style="max-width: 180px;">${usr.nombre}</div>
                    <small class="text-muted d-flex align-items-center">
                        ${esAdmin ? '🌟 Admin • ' : ''} <span class="${usr.online ? 'text-success fw-bold ms-1' : 'ms-1'}">${textoEstado}</span>
                    </small>
                </div>
                ${notificationBadge}
            </button>`;
        }
        html += '</div>';
        
        if (listaMain) listaMain.innerHTML = html;
        if (listaModal) listaModal.innerHTML = html;
    },

    // 4. FLUJO DE CHAT PRIVADO
    seleccionarContacto(nombre) {
        this.chatActivoNombre = nombre;
        
        const roomContainer = document.getElementById('chat-room');
        
        // 1. Quitamos el d-none y agregamos la clase activa para que deslice la hoja
        if(roomContainer) {
            roomContainer.classList.remove('d-none');
            // Pequeño retardo para asegurar que la animación CSS se ejecute
            setTimeout(() => {
                roomContainer.classList.add('activa');
            }, 10);
        }
        
        // 2. Actualizamos el nombre del usuario en la nueva cabecera
        const userHeader = document.getElementById('chat-active-user');
        if(userHeader) {
            userHeader.textContent = nombre;
        }

        // 3. Iniciamos el historial
        this.cargarHistorial();
        this.intervaloChat = setInterval(() => this.cargarHistorial(true), 2500);
    },

    volverAContactos() {
        this.chatActivoNombre = null;
        this._lastChatHtml = ""; 
        
        const roomContainer = document.getElementById('chat-room');
        
        if(roomContainer) {
            // 1. Quitamos la clase activa para que la hoja deslice hacia afuera
            roomContainer.classList.remove('activa');
            // 2. Esperamos a que termine la animación (300ms) para ocultar el div completamente
            setTimeout(() => {
                roomContainer.classList.add('d-none');
            }, 300);
        }
        
        clearInterval(this.intervaloChat);
        this.ejecutarTareasGlobales();
    },

    async cargarHistorial(esPolling = false) {
        const miNombre = this.verificarIdentidad();
        if (!miNombre || !this.chatActivoNombre) return;

        const res = await this.llamarAPI('/historial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emisor: miNombre, receptor: this.chatActivoNombre })
        });

        if (res.status === 'ok') {
            this.renderizarMensajes(res.mensajes, miNombre, esPolling);
            
            const noLeidos = res.mensajes.filter(m => m.receptor === miNombre && m.is_read === 0);
            if(noLeidos.length > 0) {
                this.llamarAPI('/leer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ emisor: this.chatActivoNombre, receptor: miNombre })
                });
            }
        } else if (!esPolling) {
            const ventana = document.getElementById('chat-window');
            if (ventana) {
                ventana.innerHTML = `
                <div class="m-3 p-3 bg-white rounded border border-danger shadow-sm text-center">
                    <h6 class="text-danger fw-bold">Error del Servidor</h6>
                    <small class="text-muted">${res.error || "No se pudo cargar el historial."}</small>
                </div>`;
            }
        }
    },

    renderizarMensajes(mensajes, miNombre, esPolling = false) {
        const ventana = document.getElementById('chat-window');
        if (!ventana) return;

        const dataHash = JSON.stringify(mensajes);
        if (this._lastChatHtml === dataHash) return; 

        let html = '';
        
        if (!mensajes || mensajes.length === 0) {
            html = `<div class="d-flex justify-content-center mt-4"><span class="bg-white text-muted small rounded-pill px-4 py-2 shadow-sm border">Inicia la conversación con ${this.chatActivoNombre}</span></div>`;
        } else {
            mensajes.forEach(m => {
                try {
                    const esMio = (m.emisor === miNombre);
                    const alineacionContenedor = esMio ? 'justify-content-end' : 'justify-content-start';
                    const colorBg = esMio ? 'bg-warning text-dark' : 'bg-white text-dark';
                    const borderCls = esMio ? 'rounded-4 rounded-bottom-right-0' : 'rounded-4 rounded-bottom-left-0 shadow-sm border';
                    
                    const checkIcon = m.is_read === 1 
                        ? '<i class="bi bi-check2-all text-primary ms-1" style="font-size:0.85rem;"></i>' 
                        : '<i class="bi bi-check2 text-secondary ms-1" style="font-size:0.85rem;"></i>';

                    const deleteIcon = `<i class="bi bi-trash-fill text-danger ms-2" style="font-size:0.8rem; cursor:pointer;" onclick="window.borrarMensajeChat(${m.id})" title="Borrar para todos"></i>`;

                    let mediaHtml = '';
                    if (m.archivo_url) {
                        const ext = m.archivo_url.split('.').pop().toLowerCase();
                        
                        if (['mp4', 'webm', 'mov', 'avi'].includes(ext) || (m.tipo_archivo && m.tipo_archivo.startsWith('video'))) {
                            mediaHtml = `<video src="${m.archivo_url}" controls class="rounded w-100 shadow-sm mt-2 mb-1" style="max-width: 250px; background: #000;"></video>`;
                        } 
                        else if (['png', 'jpg', 'jpeg', 'gif'].includes(ext) || (m.tipo_archivo && m.tipo_archivo.startsWith('image'))) {
                            mediaHtml = `<img src="${m.archivo_url}" class="img-fluid rounded shadow-sm mt-2 mb-1 cursor-pointer" style="max-height: 250px;" onclick="window.open('${m.archivo_url}','_blank')">`;
                        } 
                        else if (['mp3', 'wav', 'wma', 'ogg'].includes(ext) || (m.tipo_archivo && m.tipo_archivo.startsWith('audio'))) {
                            mediaHtml = `<audio src="${m.archivo_url}" controls class="w-100 mt-2 mb-1" style="max-width: 240px;"></audio>`;
                        }
                        else {
                            mediaHtml = `
                            <a href="${m.archivo_url}" target="_blank" class="btn btn-sm btn-light border shadow-sm rounded d-flex align-items-center mt-2 mb-1 text-decoration-none text-dark">
                                <i class="bi bi-file-earmark-arrow-down-fill text-danger fs-4 me-2"></i>
                                <div class="text-truncate text-start" style="max-width: 150px;">
                                    <span class="d-block fw-bold" style="font-size: 0.8rem;">Descargar</span>
                                    <span class="d-block text-muted text-uppercase" style="font-size: 0.7rem;">${ext}</span>
                                </div>
                            </a>`;
                        }
                    }

                    // Formateo seguro de fecha
                    let timeStr = "";
                    try {
                        if (m.timestamp) {
                            const safeTimestamp = m.timestamp.replace(/-/g, '/').replace('T', ' ');
                            const d = new Date(safeTimestamp);
                            if (!isNaN(d)) {
                                timeStr = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                            } else {
                                timeStr = m.timestamp.substring(11, 16); 
                            }
                        }
                    } catch(e) { timeStr = "00:00"; }

                    html += `
                    <div class="d-flex w-100 ${alineacionContenedor} mb-2">
                        <div class="p-2 px-3 ${colorBg} ${borderCls} position-relative" style="max-width: 80%;">
                            ${mediaHtml}
                            ${m.texto ? `<div style="word-wrap: break-word; white-space: pre-wrap; line-height: 1.3; font-size: 0.95rem;">${m.texto}</div>` : ''}
                            <div class="text-end mt-1 d-flex align-items-center justify-content-end" style="margin-bottom: -3px;">
                                <small class="text-muted" style="font-size: 0.65rem;">
                                    ${timeStr}
                                    ${esMio ? checkIcon : ''}
                                </small>
                                ${deleteIcon}
                            </div>
                        </div>
                    </div>`;
                } catch (loopError) {
                    console.error("Fallo renderizando un mensaje:", m);
                }
            });
        }
        
        ventana.innerHTML = html;
        this._lastChatHtml = dataHash; 
        
        setTimeout(() => {
            ventana.scrollTop = ventana.scrollHeight;
        }, 100);
    },

    // 5. BORRAR MENSAJE
    async borrarMensaje(id) {
        if (window.mostrarConfirmacion) {
            window.mostrarConfirmacion("¿Deseas eliminar este mensaje para todos?", async () => {
                await this._ejecutarBorrado(id);
            });
        } else {
            if (confirm("¿Deseas eliminar este mensaje para todos?")) {
                await this._ejecutarBorrado(id);
            }
        }
    },

    async _ejecutarBorrado(id) {
        const res = await this.llamarAPI('/borrar_mensaje', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        });

        if (res.status === 'ok') {
            this.cargarHistorial(); 
        } else {
            if (window.mostrarAlerta) window.mostrarAlerta("No se pudo borrar: " + res.error, "Error", "error");
        }
    },

    // 6. ENVÍO DE MENSAJES Y ARCHIVOS
    async enviarMensaje() {
        const miNombre = this.verificarIdentidad();
        if (!miNombre || !this.chatActivoNombre) return;

        const inputTexto = document.getElementById('chat-msg-input');
        const inputFile = document.getElementById('chat-file');
        const texto = inputTexto.value.trim();
        const archivo = inputFile.files.length > 0 ? inputFile.files[0] : null;

        if (!texto && !archivo) return;

        inputTexto.disabled = true;
        let archivo_url = '';
        let tipo_archivo = '';

        try {
            if (archivo) {
                const formData = new FormData();
                formData.append('archivo', archivo);
                
                const resSubida = await fetch(`${CHATT_API}/subir`, {
                    method: 'POST',
                    body: formData
                });
                const dataSubida = await resSubida.json();
                
                if (dataSubida.status === 'ok') {
                    archivo_url = dataSubida.url;
                    tipo_archivo = archivo.type;
                } else {
                    if (window.mostrarAlerta) window.mostrarAlerta("Fallo subiendo archivo: " + dataSubida.error, "Error", "error");
                    inputTexto.disabled = false;
                    return;
                }
            }

            const res = await this.llamarAPI('/enviar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emisor: miNombre,
                    receptor: this.chatActivoNombre,
                    texto: texto,
                    archivo_url: archivo_url,
                    tipo_archivo: tipo_archivo
                })
            });

            if (res.status === 'ok') {
                inputTexto.value = '';
                inputTexto.style.height = 'auto'; 
                this.limpiarAdjuntoUI();
                this.cargarHistorial(); 
            } else {
                if (window.mostrarAlerta) window.mostrarAlerta(res.error, "Error Backend", "error");
            }

        } catch (e) {
            console.error('Fallo en el proceso de envío.', e);
        } finally {
            inputTexto.disabled = false;
            inputTexto.focus();
        }
    },

    limpiarAdjuntoUI() {
        const fileInput = document.getElementById('chat-file');
        const label = document.getElementById('label-adjunto');
        const preview = document.getElementById('chat-adjunto-preview');
        
        if(fileInput) fileInput.value = '';
        if(label) label.classList.remove('btn-adjunto-active', 'bg-warning');
        if(preview) {
            preview.classList.add('d-none');
            preview.classList.remove('d-flex');
        }
    },

    abrirModal() {
        const modalEl = document.getElementById('modalChat');
        if (!modalEl) return;
        
        // --- SOLUCIÓN DEFINITIVA AL BLOQUEO DE TECLADO ---
        // { focus: false } evita que Bootstrap secuestre el cursor.
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) {
            modal = new bootstrap.Modal(modalEl, { focus: false });
        }
        modal.show();

        this.volverAContactos();
        this.ejecutarTareasGlobales();
    }
};

// EXPOSICIÓN GLOBAL PARA EL HTML
window.abrirModalChat = () => window.ChatManager.abrirModal();
window.volverAContactos = () => window.ChatManager.volverAContactos();
window.abrirChatDirecto = (nombre) => {
    // Al tocar un contacto, llamamos directamente la animación de la nueva hoja
    window.ChatManager.seleccionarContacto(nombre);
};
window.enviarAccionChat = () => window.ChatManager.enviarMensaje();
window.limpiarAdjuntoChat = () => window.ChatManager.limpiarAdjuntoUI();
window.borrarMensajeChat = (id) => window.ChatManager.borrarMensaje(id);

// Manejo del archivo adjunto (Máx 60 MB)
window.actualizarEstadoAdjunto = (inp) => {
    const label = document.getElementById('label-adjunto');
    const preview = document.getElementById('chat-adjunto-preview');
    const nombre = document.getElementById('chat-adjunto-nombre');
    
    if (inp.files.length > 0) {
        const file = inp.files[0];
        const maxMB = 60;
        
        if (file.size > maxMB * 1024 * 1024) {
            if (window.mostrarAlerta) window.mostrarAlerta(`El archivo es demasiado grande (Máx ${maxMB}MB).`, "Archivo Rechazado", "error");
            window.ChatManager.limpiarAdjuntoUI();
            return;
        }

        label.classList.add('btn-adjunto-active', 'bg-warning');
        if(preview) {
            preview.classList.remove('d-none');
            preview.classList.add('d-flex');
            nombre.textContent = file.name;
        }
    } else {
        window.ChatManager.limpiarAdjuntoUI();
    }
};

// Eventos de teclado y redimensionamiento
document.addEventListener('input', (e) => {
    if (e.target.id === 'chat-msg-input') {
        e.target.style.height = 'auto';
        e.target.style.height = (e.target.scrollHeight < 100 ? e.target.scrollHeight : 100) + 'px';
    }
});

document.addEventListener('keydown', (e) => {
    if (e.target.id === 'chat-msg-input' && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); 
        window.enviarAccionChat();
    }
});