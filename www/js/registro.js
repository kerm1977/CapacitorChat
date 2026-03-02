// www/js/registro.js
// Todo envuelto en un try-catch global para que un error no mate tu SPA.
try {
    // --- VISIBILIDAD DE CONTRASEÑAS (Debe ser global para los onclick) ---
    window.togglePassword = function(inputId, iconId) {
        const inputPass = document.getElementById(inputId);
        const iconoOjo = document.getElementById(iconId);
        
        if (!inputPass || !iconoOjo) return;

        if (inputPass.type === 'password') {
            inputPass.type = 'text';
            iconoOjo.className = 'bi bi-eye-slash-fill fs-5 text-primary';
        } else {
            inputPass.type = 'password';
            iconoOjo.className = 'bi bi-eye-fill fs-5 text-secondary';
        }
    };

    // Función principal de inicialización
    function inicializarFormulario() {
        const formRegistro = document.getElementById('form-registro');
        if (!formRegistro) return;
        
        // Evitamos inicializar dos veces si entramos y salimos de la vista
        if (formRegistro.dataset.inicializado) return;
        formRegistro.dataset.inicializado = "true";

        // --- 1. LÓGICA DE IMAGEN Y EDITOR ---
        const avatarInput = document.getElementById('avatarInput');
        const avatarPreview = document.getElementById('avatarPreview');
        const avatarPlaceholder = document.getElementById('avatarPlaceholder');
        const avatarControls = document.getElementById('avatarControls');
        const zoomRange = document.getElementById('zoomRange');
        const xRange = document.getElementById('xRange');
        const avatarContainer = document.getElementById('avatarContainer');

        if(avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        avatarPreview.src = event.target.result;
                        avatarPreview.classList.remove('d-none');
                        avatarPlaceholder.classList.add('d-none');
                        avatarControls.classList.remove('d-none');
                        
                        avatarContainer.style.border = '4px solid #ffffff';
                        
                        zoomRange.value = 1;
                        xRange.value = 0;
                        updateAvatarTransform();
                    }
                    reader.readAsDataURL(file);
                }
            });

            function updateAvatarTransform() {
                const scale = zoomRange.value;
                const translateX = xRange.value;
                avatarPreview.style.transform = `scale(${scale}) translateX(${translateX}px)`;
            }

            zoomRange.addEventListener('input', updateAvatarTransform);
            xRange.addEventListener('input', updateAvatarTransform);
        }

        // --- 2. FORMATEADORES DE TEXTO (Title Case) ---
        function toTitleCase(str) {
            return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }

        const inputNombre = document.getElementById('regNombre');
        if(inputNombre) {
            inputNombre.addEventListener('input', (e) => {
                let val = e.target.value;
                val = val.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
                const parts = val.split(' ');
                if (parts.length > 2) val = parts[0] + ' ' + parts.slice(1).join('');
                e.target.value = toTitleCase(val);
            });
        }

        const apellidosInputs = ['regApellido1', 'regApellido2', 'emgNombre'];
        apellidosInputs.forEach(id => {
            const input = document.getElementById(id);
            if(!input) return;
            input.addEventListener('input', (e) => {
                let val = e.target.value;
                if(id === 'emgNombre'){
                    val = val.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
                    val = val.replace(/\s{2,}/g, ' '); 
                } else {
                    val = val.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, ''); 
                }
                e.target.value = toTitleCase(val);
            });
        });

        const inputEmail = document.getElementById('regEmail');
        if(inputEmail) {
            inputEmail.addEventListener('input', (e) => {
                e.target.value = e.target.value.toLowerCase();
            });
        }

        // --- 3. LÓGICA DE TELÉFONOS (8 números exactos) ---
        const telInputs = ['regTelefono', 'emgTelefono'];
        telInputs.forEach(id => {
            const input = document.getElementById(id);
            if(!input) return;
            input.addEventListener('input', (e) => {
                let val = e.target.value.replace(/\D/g, ''); 
                if (val.length > 8) val = val.substring(0, 8); 
                e.target.value = val;
                
                if(id === 'regTelefono'){
                    const errorMsg = document.getElementById('telError');
                    if(val.length > 0 && val.length < 8) {
                        errorMsg.classList.remove('d-none');
                        input.classList.add('is-invalid');
                    } else {
                        errorMsg.classList.add('d-none');
                        input.classList.remove('is-invalid');
                    }
                }
            });
        });

        // --- 4. GENERAR PIN ---
        function generatePIN() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let pin = '';
            for (let i = 0; i < 8; i++) {
                pin += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return pin;
        }
        const regPinInput = document.getElementById('regPin');
        if(regPinInput && !regPinInput.value) regPinInput.value = generatePIN();

        // --- 5. FECHA DE NACIMIENTO Y EDAD ---
        const selectDia = document.getElementById('dobDia');
        const selectMes = document.getElementById('dobMes');
        const selectAnio = document.getElementById('dobAnio');
        const edadText = document.getElementById('edadText');
        
        if(selectDia && selectMes && selectAnio) {
            const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const hoy = new Date();
            const anioActual = hoy.getFullYear();
            const anioMax = anioActual - 15; 
            const anioMin = 1930;

            if (selectAnio.options.length === 0) {
                for (let y = anioMax; y >= anioMin; y--) {
                    const option = document.createElement('option');
                    option.value = y; option.textContent = y;
                    selectAnio.appendChild(option);
                }

                meses.forEach((mes, index) => {
                    const option = document.createElement('option');
                    option.value = index; option.textContent = mes;
                    selectMes.appendChild(option);
                });
            }

            function actualizarDias() {
                const anio = parseInt(selectAnio.value);
                const mes = parseInt(selectMes.value);
                const diasEnMes = new Date(anio, mes + 1, 0).getDate();
                
                const diaPrevio = selectDia.value;
                selectDia.innerHTML = '';
                
                for (let d = 1; d <= diasEnMes; d++) {
                    const option = document.createElement('option');
                    option.value = d; option.textContent = d;
                    selectDia.appendChild(option);
                }
                if (diaPrevio && diaPrevio <= diasEnMes) selectDia.value = diaPrevio;
            }

            function calcularEdad() {
                const anio = parseInt(selectAnio.value);
                const mes = parseInt(selectMes.value);
                const dia = parseInt(selectDia.value);
                if(!anio || isNaN(mes) || !dia) return;

                const fechaNac = new Date(anio, mes, dia);
                let edad = hoy.getFullYear() - fechaNac.getFullYear();
                const m = hoy.getMonth() - fechaNac.getMonth();
                
                if (m < 0 || (m === 0 && hoy.getDate() < fechaNac.getDate())) edad--;
                edadText.textContent = edad;
            }

            selectAnio.addEventListener('change', () => { actualizarDias(); calcularEdad(); });
            selectMes.addEventListener('change', () => { actualizarDias(); calcularEdad(); });
            selectDia.addEventListener('change', calcularEdad);

            actualizarDias();
            calcularEdad();
        }

        // --- 7. PROCESAR REGISTRO REAL (CONEXIÓN A FLASK) ---
        formRegistro.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const tel = document.getElementById('regTelefono').value;
            const emTel = document.getElementById('emgTelefono').value;
            if (tel.length !== 8) return alert('El teléfono principal debe tener exactamente 8 números.');
            if (emTel && emTel.length !== 8) return alert('El teléfono de emergencia debe tener exactamente 8 números.');
            
            const pw1 = document.getElementById('regPassword').value;
            const pw2 = document.getElementById('regConfirmPassword').value;
            if(pw1 !== pw2) return alert('Las contraseñas no coinciden.');

            const btn = document.getElementById('btnRegistro');
            const btnText = document.getElementById('btnRegText');
            const btnSpinner = document.getElementById('btnRegSpinner');

            btn.disabled = true;
            btnText.textContent = 'Procesando...';
            btnSpinner.classList.remove('d-none');

            try {
                const apellidosUnidos = document.getElementById('regApellido1').value.trim() + " " + document.getElementById('regApellido2').value.trim();

                // AQUÍ ESTABA EL ERROR: HEMOS INYECTADO LAS 3 LÍNEAS FINALES DE LA FECHA (dob) 
                const payload = {
                    nombre: document.getElementById('regNombre').value.trim(),
                    apellido1: apellidosUnidos, 
                    email: document.getElementById('regEmail').value.trim(),
                    pin: document.getElementById('regPin').value.trim(),
                    password: pw1,
                    telefono: document.getElementById('regTelefono') ? document.getElementById('regTelefono').value.trim() : '',
                    emgNombre: document.getElementById('emgNombre') ? document.getElementById('emgNombre').value.trim() : '',
                    emgTelefono: document.getElementById('emgTelefono') ? document.getElementById('emgTelefono').value.trim() : '',
                    // --- ENVIAMOS LA FECHA AL SERVIDOR PARA QUE SE GUARDE CORRECTAMENTE ---
                    dobDia: document.getElementById('dobDia') ? document.getElementById('dobDia').value : '',
                    dobMes: document.getElementById('dobMes') ? document.getElementById('dobMes').value : '',
                    dobAnio: document.getElementById('dobAnio') ? document.getElementById('dobAnio').value : ''
                };

                const respuesta = await fetch(`${API_URL}/registro`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const resultado = await respuesta.json();

                if (!respuesta.ok || resultado.error) {
                    throw new Error(resultado.error || "Ocurrió un error en el servidor.");
                }

                alert('¡Cuenta creada exitosamente en la nube!');
                formRegistro.reset();
                window.location.hash = 'login'; 

            } catch (error) {
                alert("Error: " + error.message);
            } finally {
                btn.disabled = false;
                btnText.textContent = 'Registrarse';
                btnSpinner.classList.add('d-none');
            }
        });
    }

    // ========================================================================
    // MAGIA SPA: Observar cuándo el usuario navega a la página de registro
    // ========================================================================
    
    // Intenta inicializar si el usuario recargó la página estando ya en #registro
    document.addEventListener('DOMContentLoaded', inicializarFormulario);
    
    // Escucha cada vez que cambia la vista en la SPA
    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#registro') {
            // Le damos 150ms al enrutador para inyectar el HTML antes de buscar los IDs
            setTimeout(inicializarFormulario, 150);
        }
    });

} catch (err) {
    console.error("Error crítico en el script de registro:", err);
}