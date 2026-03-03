// Esta URL será actualizada automáticamente por el script configurar_proyecto.js
// Ejemplo: https://kenth1977.pythonanywhere.com/api/MiAppSlug
const API_URL = "https://kenth1977.pythonanywhere.com/api/TribuApp";  

window.CloudDB = {
    // 1. Función para LEER todos los usuarios (El Ranking) de la app actual
    async obtenerUsuarios() {
        try {
            const respuesta = await fetch(`${API_URL}/ranking`, { 
                headers: { 'Accept': 'application/json' }
            });
            
            if (!respuesta.ok) return [];
            
            const datos = await respuesta.json();
            if (datos.error) return [];
            return datos;
        } catch (error) { 
            console.error("Error al obtener usuarios:", error);
            return []; 
        }
    },

    // 2. Función para LEER las Caminatas (Eventos) de la app actual
    async obtenerEventos() {
        try {
            const respuesta = await fetch(`${API_URL}/eventos`, { 
                headers: { 'Accept': 'application/json' }
            });
            
            if (!respuesta.ok) return [];

            const datos = await respuesta.json();
            if (datos.error) return [];
            return datos;
        } catch (error) { 
            console.error("Error al obtener eventos:", error);
            return []; 
        }
    },

    // 3. Función para INSCRIBIRSE usando el PIN
    // Nota: Asegúrate de que tu Motor Universal en app.py tenga implementada la ruta /inscribir
    async inscribirEvento(pin, eventId) {
        try {
            const respuesta = await fetch(`${API_URL}/inscribir`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ pin: pin, event_id: eventId })
            });
            
            const resultado = await respuesta.json();
            if (resultado.error) {
                return { status: "error", message: resultado.error };
            }
            return resultado; // Retorna status "ok" y el mensaje de éxito
        } catch (error) {
            console.error("Error en la inscripción:", error);
            return { status: "error", message: "Error de conexión con el servidor" };
        }
    }
};