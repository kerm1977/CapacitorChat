const fs = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https'); // <-- IMPORTANTE: Módulo añadido para conexiones web

// Configuración de la interfaz de terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Script de automatización para el Motor Universal v2
 * Este script configura los archivos locales para conectar con una base de datos 
 * específica en PythonAnywhere basándose en el nombre de la App.
 */

// Rutas a los archivos locales
const capacitorFile = path.join(__dirname, 'capacitor.config.json');
const packageJsonFile = path.join(__dirname, 'package.json');

// Intentamos localizar api_db.js en la raíz, en www/ o en www/js/
let apiDbFile = path.join(__dirname, 'api_db.js');

if (!fs.existsSync(apiDbFile)) {
    apiDbFile = path.join(__dirname, 'www', 'api_db.js');
}

// Si aún no existe, probamos en la subcarpeta js/
if (!fs.existsSync(apiDbFile)) {
    apiDbFile = path.join(__dirname, 'www', 'js', 'api_db.js');
}

console.log("======================================================");
console.log("🚀  ASISTENTE MULTI-APP (MOTOR UNIVERSAL V2)");
console.log("======================================================\n");

rl.question('1. Nombre de la nueva App (Ej: Altair Pro): ', (appNameInput) => {
    const appName = appNameInput.trim() || 'MiApp';
    const appSlug = appName.replace(/[^a-zA-Z0-9 ]/g, ''); // Permite espacios temporalmente
    // Corregimos aquí para que el nombre de la base de datos mantenga las mayúsculas/minúsculas ingresadas
    const dbSlug = appSlug.replace(/\s+/g, ''); 
    const defaultId = `com.${appSlug.replace(/\s+/g, '').toLowerCase()}.app`; // ID sin espacios

    // === MODIFICACIÓN: Autollenado en la consola ===
    rl.question(`2. ID de la App (Puedes editarlo o presionar Enter): `, (appIdInput) => {
        const appId = appIdInput.trim() || defaultId;

        // === PREGUNTAR POR EL ÍCONO AQUÍ ===
        rl.question('\n3. ¿Desea cambiar el icono de la aplicacion? (S/N): ', (askIcon) => {
            const ans = askIcon.trim().toLowerCase();
            if (ans === 's' || ans === 'si') {
                rl.question('   [INFO] Arrastra aqui tu imagen (Soporta PNG y JPG): ', (iconPathInput) => {
                    let iconPath = iconPathInput.trim().replace(/^["']|["']$/g, '');
                    
                    // =========================================================
                    // Traducción de rutas WSL (/mnt/c/...) a Windows (C:\...)
                    // =========================================================
                    if (iconPath.toLowerCase().startsWith('/mnt/')) {
                        const parts = iconPath.split('/');
                        const drive = parts[2].toUpperCase(); // 'c' -> 'C'
                        const rest = parts.slice(3).join('\\');
                        iconPath = `${drive}:\\${rest}`;
                    }

                    // Llamamos a procesar, respetando las mayúsculas del nombre
                    finalizarConfiguracion(appName, dbSlug, appId, iconPath);
                });
            } else {
                finalizarConfiguracion(appName, dbSlug, appId, "");
            }
        });
    });
    
    // ESTA ES LA MAGIA: Escribe el ID en la línea de comandos para que el usuario pueda editarlo
    rl.write(defaultId); 
});

async function finalizarConfiguracion(appName, appSlug, appId, iconPath) {
    console.log("\n⏳ Aplicando cambios en archivos locales...");

    try {
        if (fs.existsSync(capacitorFile)) {
            let cap = JSON.parse(fs.readFileSync(capacitorFile, 'utf8'));
            cap.appId = appId;
            cap.appName = appName;
            fs.writeFileSync(capacitorFile, JSON.stringify(cap, null, 2), 'utf8');
            console.log(`  [✔] capacitor.config.json -> App: ${appName}`);
        }
    } catch (e) { console.error("  [!] Error en capacitor.config.json:", e.message); }

    try {
        if (fs.existsSync(apiDbFile)) {
            let apiContent = fs.readFileSync(apiDbFile, 'utf8');
            const regex = /const API_URL = ".*";/;
            apiContent = apiContent.replace(regex, `const API_URL = "https://kenth1977.pythonanywhere.com/api/${appSlug}";`);
            fs.writeFileSync(apiDbFile, apiContent, 'utf8');
            console.log(`  [✔] api_db.js              -> Encontrado y actualizado`);
            console.log(`  [✔] URL actualizada        -> https://kenth1977.pythonanywhere.com/api/${appSlug}`);
        }
    } catch (e) { console.error("  [!] Error en api_db.js:", e.message); }

    try {
        if (fs.existsSync(packageJsonFile)) {
            let pkg = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
            pkg.name = appSlug.toLowerCase();
            fs.writeFileSync(packageJsonFile, JSON.stringify(pkg, null, 2), 'utf8');
            console.log(`  [✔] package.json            -> Nombre: ${pkg.name}`);
        }
    } catch (e) {}

    // =============================================================
    // CREAR ARCHIVO DE ENLACE PARA CONSTRUIR.BAT
    // =============================================================
    try {
        const androidDir = path.join(__dirname, 'android');
        if (fs.existsSync(androidDir)) {
            const buildConfigFile = path.join(androidDir, 'build_config.bat');
            // Guardamos las respuestas en variables de Batch (.bat)
            const batContent = `@echo off\nset "CUSTOM_NAME=${appName}"\nset "ICON_PATH=${iconPath}"\n`;
            fs.writeFileSync(buildConfigFile, batContent, 'utf8');
            console.log(`  [✔] build_config.bat        -> Enlace creado para automatizar compilacion`);
        }
    } catch(e) {
        console.error("  [!] Error creando build_config.bat:", e.message);
    }

    // =============================================================
    // AUTO-REGISTRO EN LA BASE DE DATOS REMOTA
    // =============================================================
    console.log("\n⏳ Conectando con el servidor de PythonAnywhere...");
    try {
        // 1. Ejecutar la ruta /crear_ahora para instanciar el archivo de Base de Datos
        // NOTA: Se respeta mayúsculas/minúsculas de la variable appSlug
        const urlCrear = `https://kenth1977.pythonanywhere.com/api/${appSlug}/crear_ahora`;
        
        await new Promise((resolve, reject) => {
            https.get(urlCrear, (res) => {
                 // Capturamos el status code. Si es 200, la BD se creó bien.
                if(res.statusCode === 200) {
                   res.on('data', () => {}); // Consumir respuesta
                   res.on('end', resolve);
                } else {
                   reject(new Error(`El servidor devolvió el código: ${res.statusCode} en la creación de la Base de Datos.`));
                }
            }).on('error', reject);
        });
        console.log(`  [✔] Base de datos ${appSlug}.db generada y verificada en el servidor.`);

        // 2. Inyectar los superusuarios maestros
        const superusuarios = [
            { nombre: "kenth1977@gmail.com", password: "CR129x7848n" },
            { nombre: "lthikingcr@gmail.com", password: "CR129x7848n" }
        ];

        for (const su of superusuarios) {
            const dataStr = JSON.stringify({
                nombre: su.nombre,
                password: su.password,
                esRegistro: true
            });

            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(dataStr)
                }
            };

            await new Promise((resolve, reject) => {
                const req = https.request(`https://kenth1977.pythonanywhere.com/api/${appSlug}/registro`, options, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        // Incluso si el backend dice "Usuario ya existe" (400) o falla (500), 
                        // continuamos con el script, pero lo notificamos en consola.
                        if(res.statusCode >= 400) {
                            console.log(`  [!] Info: El usuario ${su.nombre} ya estaba registrado o hubo un error menor (HTTP ${res.statusCode}).`);
                        }
                        resolve();
                    });
                });
                req.on('error', reject);
                req.write(dataStr);
                req.end();
            });
        }
        console.log(`  [✔] Superusuarios maestros registrados exitosamente.`);
        
    } catch (error) {
        console.error(`  [!] Advertencia crítica en servidor: ${error.message}`);
        console.log(`      Por favor, asegúrate de visitar la siguiente URL de forma manual:`);
        console.log(`      👉 https://kenth1977.pythonanywhere.com/api/${appSlug}/crear_ahora`);
    }

    console.log("\n======================================================");
    console.log("✨ ¡CONFIGURACIÓN COMPLETADA Y EN LÍNEA!");
    console.log(`📡 Tu App apunta a: ${appSlug}.db`);
    console.log("\nPROXIMOS PASOS:");
    console.log(`1. Entra a la carpeta android: cd android`);
    console.log(`2. Ejecuta: construir.bat`);
    console.log("======================================================\n");
    
    rl.close();
}