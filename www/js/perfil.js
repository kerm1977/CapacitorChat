/**
 * Controlador Lógico para la vista de Perfil (perfil.html)
 */

try {
    // 1. Función para cerrar sesión globalmente
    window.cerrarSesion = function() {
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
            localStorage.removeItem('usuarioActual');
            if (typeof window.setLoginState === 'function') {
                window.setLoginState(false);
            }
            window.location.hash = 'login';
        }
    };

    // 2. Función principal para cargar la información. 
    // Usamos 'window' para que el HTML pueda ejecutarla instantáneamente
    window.cargarDatosPerfil = function() {
        try {
            // Verificamos si la vista está activa actualmente en el DOM
            if (!document.getElementById('userName')) return;

            // Buscamos primero si hay un usuario logueado en la sesión actual
            let datosGuardados = localStorage.getItem('usuarioActual'); 
            
            // Si no hay usuario logueado (sesión), intentamos cargar el último registrado
            if (!datosGuardados) {
                 datosGuardados = localStorage.getItem('usuarioRegistrado');
            }
            
            if (datosGuardados) {
                const usuario = JSON.parse(datosGuardados);
                
                // RASTREADOR: Te ayudará a ver qué datos están llegando realmente desde la Base de Datos
                console.log("⚙️ Cargando Perfil. Datos en memoria:", usuario);
                
                // Inyectamos los datos básicos de Texto
                document.getElementById('userName').textContent = usuario.nombre || usuario.username || 'Miembro de la Tribu';
                document.getElementById('userEmail').textContent = usuario.email || '';
                
                // Inyectamos el PIN si existe el elemento
                if (document.getElementById('userPin')) {
                    document.getElementById('userPin').textContent = usuario.pin || '------';
                }
                
                // --- NUEVO: INYECCIÓN DE TELÉFONOS Y EMERGENCIA ---
                // Filtro ultra-seguro para limpiar valores nulos de la base de datos
                const getValorSeguro = (val) => {
                    if (val === null || val === undefined || val === 'null' || val === 'undefined') return 'No registrado';
                    if (val.toString().trim() === '') return 'No registrado';
                    return val;
                };

                const txtTelefono = getValorSeguro(usuario.telefono);
                const txtEmgNombre = getValorSeguro(usuario.emgNombre);
                const txtEmgTelefono = getValorSeguro(usuario.emgTelefono);

                if (document.getElementById('userTelefono')) {
                    document.getElementById('userTelefono').textContent = txtTelefono;
                }
                
                if (document.getElementById('userEmgNombre')) {
                    document.getElementById('userEmgNombre').textContent = txtEmgNombre;
                }
                
                if (document.getElementById('userEmgTelefono')) {
                    document.getElementById('userEmgTelefono').textContent = txtEmgTelefono;
                }

                // --- NUEVO: RECUPERACIÓN PERSISTENTE DE LA EDAD ---
                // Como la BD de Python no guarda la fecha, la rescatamos de nuestra caja fuerte local segura
                const dobLocal = localStorage.getItem('tribu_dob_' + usuario.email);
                if (dobLocal) {
                    const dobP = JSON.parse(dobLocal);
                    usuario.dobAnio = dobP.dobAnio || usuario.dobAnio;
                    usuario.dobMes = dobP.dobMes || usuario.dobMes;
                    usuario.dobDia = dobP.dobDia || usuario.dobDia;
                }

                // Cálculo de la Edad (Si tiene fecha de nacimiento guardada)
                if (document.getElementById('userEdad')) {
                    if (usuario.dobAnio) {
                        const hoy = new Date();
                        const anioNac = parseInt(usuario.dobAnio);
                        const mesNac = parseInt(usuario.dobMes || 0);
                        const diaNac = parseInt(usuario.dobDia || 1);
                        
                        let edad = hoy.getFullYear() - anioNac;
                        const m = hoy.getMonth() - mesNac;
                        if (m < 0 || (m === 0 && hoy.getDate() < diaNac)) {
                            edad--;
                        }
                        document.getElementById('userEdad').textContent = edad + ' años';
                    } else {
                        document.getElementById('userEdad').textContent = '-- años';
                    }
                }

                // Lógica de Avatar
                const avatarImg = document.getElementById('userAvatar');
                if (avatarImg) {
                    if (usuario.avatar && usuario.avatar.trim() !== '') {
                        // Si el usuario subió una foto, la mostramos
                        avatarImg.src = usuario.avatar;
                    } else {
                        // Si no tiene foto, usamos una API gratuita para generar una imagen con sus iniciales
                        const nombreUrl = encodeURIComponent(usuario.nombre || usuario.username || 'Usuario');
                        avatarImg.src = `https://ui-avatars.com/api/?name=${nombreUrl}&background=0d6efd&color=fff&size=150&font-size=0.4`;
                    }
                }

            } else {
                // Si por alguna razón entra al perfil pero no hay datos locales
                document.getElementById('userName').textContent = 'Usuario Invitado';
                document.getElementById('userEmail').textContent = 'Inicia sesión para ver tus datos';
                
                if (document.getElementById('userTelefono')) document.getElementById('userTelefono').textContent = '--';
                if (document.getElementById('userEmgNombre')) document.getElementById('userEmgNombre').textContent = '--';
                if (document.getElementById('userEmgTelefono')) document.getElementById('userEmgTelefono').textContent = '--';
                if (document.getElementById('userEdad')) document.getElementById('userEdad').textContent = '-- años';
            }
        } catch (error) {
            console.error("Error al cargar los datos del perfil:", error);
        }
    };

    // ========================================================================
    // OBSERVADOR SPA: Respaldo de Seguridad
    // En caso de que el evento 'onload' de la imagen invisible falle, 
    // este listener fuerza la carga de datos al detectar que navegamos a '#perfil'
    // ========================================================================
    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#perfil') {
            setTimeout(window.cargarDatosPerfil, 150);
        }
    });

    // Disparador de emergencia si se recarga la página (F5) estando ya en la vista #perfil
    document.addEventListener('DOMContentLoaded', () => {
        if (window.location.hash === '#perfil') {
            setTimeout(window.cargarDatosPerfil, 200);
        }
    });

    // Ejecución forzada si el script cargó después del HTML
    if (window.location.hash === '#perfil' && document.readyState === 'complete') {
        setTimeout(window.cargarDatosPerfil, 200);
    }

} catch (err) {
    console.error("Error crítico inicializando perfil.js:", err);
}