import os
import sqlite3
from datetime import datetime
from flask import Blueprint, request, jsonify, make_response, send_from_directory
from werkzeug.utils import secure_filename

# ==========================================
# 1. BLUEPRINT CONFIGURATION (CHILD T)
# ==========================================
chatt_bp = Blueprint('chatt_api', __name__)

# Storage paths
BASE_DB_PATH = '/home/kenth1977/myDBs/DBs'
UPLOAD_FOLDER = '/home/kenth1977/myDBs/uploads' 

# UPDATED ALLOWED EXTENSIONS LIST
ALLOWED_EXTENSIONS = {
    'png', 'jpg', 'jpeg', 'gif',       
    'mp3', 'wav', 'wma', 'ogg',        
    'mp4', 'avi', 'mov', 'webm',       
    'pdf', 'docx', 'doc', 'txt',       
    'psd', 'ai'                        
}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_db_path(app_slug):
    return os.path.join(BASE_DB_PATH, f"{app_slug}.db")

def _corsify(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

def _preflight():
    response = make_response()
    return _corsify(response)

def _init_chatt_table(cursor):
    """Initializes the messaging table and the status table (Online/Offline)"""
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_message (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            emisor TEXT,
            receptor TEXT,
            texto TEXT,
            archivo_url TEXT,
            tipo_archivo TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_read INTEGER DEFAULT 0
        )
    ''')
    
    # NEW TABLE: To track who is online
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_status (
            nombre TEXT PRIMARY KEY,
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # === BULLETPROOF AUTOMATIC MIGRATION ===
    try:
        cursor.execute("PRAGMA table_info(chat_message)")
        columnas = [col[1] for col in cursor.fetchall()]
        
        if 'archivo_url' not in columnas:
            cursor.execute("ALTER TABLE chat_message ADD COLUMN archivo_url TEXT DEFAULT ''")
        if 'tipo_archivo' not in columnas:
            cursor.execute("ALTER TABLE chat_message ADD COLUMN tipo_archivo TEXT DEFAULT ''")
        if 'timestamp' not in columnas:
            # FIX: SQLite does NOT allow DEFAULT CURRENT_TIMESTAMP in ALTER TABLE
            cursor.execute("ALTER TABLE chat_message ADD COLUMN timestamp DATETIME")
        if 'is_read' not in columnas:
            cursor.execute("ALTER TABLE chat_message ADD COLUMN is_read INTEGER DEFAULT 0")
    except Exception as e:
        # If something fails here, it is reported in console but DOES NOT stop execution, 
        # avoiding the dreaded Error 500
        print(f"Internal migration warning (ignored): {e}")


# ==========================================
# 3. CHAT API ROUTES
# ==========================================

@chatt_bp.route('/uploads/<filename>', methods=['GET', 'OPTIONS'])
def serve_uploads(filename):
    """Bridge route: Allows PythonAnywhere to serve private files to the public"""
    if request.method == 'OPTIONS': return _preflight()
    try:
        response = make_response(send_from_directory(UPLOAD_FOLDER, filename))
        return _corsify(response)
    except Exception as e:
        return _corsify(jsonify({"error": str(e)})), 404

@chatt_bp.route('/api/<app_slug>/chatt/heartbeat', methods=['POST', 'OPTIONS'])
def heartbeat_t(app_slug):
    if request.method == 'OPTIONS': return _preflight()
    try:
        data = request.get_json()
        usuario = data.get('usuario')
        if not usuario: return _corsify(jsonify({"error": "Falta usuario"})), 400
        
        conn = sqlite3.connect(get_db_path(app_slug))
        cursor = conn.cursor()
        _init_chatt_table(cursor)
        cursor.execute('INSERT OR REPLACE INTO user_status (nombre, last_active) VALUES (?, CURRENT_TIMESTAMP)', (usuario,))
        conn.commit()
        conn.close()
        return _corsify(jsonify({"status": "ok"})), 200
    except Exception as e:
        return _corsify(jsonify({"error": str(e)})), 500

@chatt_bp.route('/api/<app_slug>/chatt/contactos', methods=['GET', 'OPTIONS'])
def contactos_t(app_slug):
    if request.method == 'OPTIONS': return _preflight()
    try:
        conn = sqlite3.connect(get_db_path(app_slug))
        cursor = conn.cursor()
        _init_chatt_table(cursor)
        
        cursor.execute('''
            SELECT m.nombre, m.rol, 
                   CASE WHEN u.last_active IS NOT NULL AND (julianday('now') - julianday(u.last_active)) * 24 * 60 < 3 THEN 1 ELSE 0 END as is_online
            FROM member m 
            LEFT JOIN user_status u ON m.nombre = u.nombre
        ''')
        
        contactos_list = []
        for row in cursor.fetchall():
            contactos_list.append({
                "nombre": row[0],
                "rol": row[1] if row[1] else "usuario",
                "online": bool(row[2])
            })
            
        conn.close()
        return _corsify(jsonify({"status": "ok", "contactos": contactos_list})), 200
    except Exception as e:
        return _corsify(jsonify({"error": str(e)})), 500

@chatt_bp.route('/api/<app_slug>/chatt/unread_details/<usuario>', methods=['GET', 'OPTIONS'])
def unread_details_t(app_slug, usuario):
    if request.method == 'OPTIONS': return _preflight()
    try:
        conn = sqlite3.connect(get_db_path(app_slug))
        cursor = conn.cursor()
        _init_chatt_table(cursor)
        cursor.execute('SELECT emisor, COUNT(*) FROM chat_message WHERE receptor = ? AND is_read = 0 GROUP BY emisor', (usuario,))
        detalles = {row[0]: row[1] for row in cursor.fetchall()}
        conn.close()
        return _corsify(jsonify({"status": "ok", "detalles": detalles})), 200
    except Exception as e:
        return _corsify(jsonify({"error": str(e)})), 500

@chatt_bp.route('/api/<app_slug>/chatt/historial', methods=['POST', 'OPTIONS'])
def historial_t(app_slug):
    if request.method == 'OPTIONS': return _preflight()
    try:
        data = request.get_json()
        emisor = data.get('emisor')
        receptor = data.get('receptor')
        
        conn = sqlite3.connect(get_db_path(app_slug))
        cursor = conn.cursor()
        _init_chatt_table(cursor)
        
        cursor.execute('''
            SELECT id, emisor, receptor, texto, archivo_url, tipo_archivo, timestamp, is_read 
            FROM chat_message 
            WHERE (emisor = ? AND receptor = ?) OR (emisor = ? AND receptor = ?)
            ORDER BY timestamp ASC
        ''', (emisor, receptor, receptor, emisor))
        
        mensajes = []
        for row in cursor.fetchall():
            mensajes.append({
                "id": row[0],
                "emisor": row[1],
                "receptor": row[2],
                "texto": row[3],
                "archivo_url": row[4],
                "tipo_archivo": row[5],
                "timestamp": row[6],
                "is_read": row[7]
            })
            
        conn.close()
        return _corsify(jsonify({"status": "ok", "mensajes": mensajes})), 200
    except Exception as e:
        return _corsify(jsonify({"error": str(e)})), 500

@chatt_bp.route('/api/<app_slug>/chatt/enviar', methods=['POST', 'OPTIONS'])
def enviar_t(app_slug):
    if request.method == 'OPTIONS': return _preflight()
    try:
        data = request.get_json()
        emisor = data.get('emisor')
        receptor = data.get('receptor')
        texto = data.get('texto', '')
        archivo_url = data.get('archivo_url', '')
        tipo_archivo = data.get('tipo_archivo', '')
        
        conn = sqlite3.connect(get_db_path(app_slug))
        cursor = conn.cursor()
        _init_chatt_table(cursor)
        
        cursor.execute('''
            INSERT INTO chat_message (emisor, receptor, texto, archivo_url, tipo_archivo, is_read)
            VALUES (?, ?, ?, ?, ?, 0)
        ''', (emisor, receptor, texto, archivo_url, tipo_archivo))
        
        conn.commit()
        conn.close()
        return _corsify(jsonify({"status": "ok"})), 200
    except Exception as e:
        return _corsify(jsonify({"error": str(e)})), 500

@chatt_bp.route('/api/<app_slug>/chatt/leer', methods=['POST', 'OPTIONS'])
def leer_t(app_slug):
    if request.method == 'OPTIONS': return _preflight()
    try:
        data = request.get_json()
        emisor = data.get('emisor')
        receptor = data.get('receptor')
        
        conn = sqlite3.connect(get_db_path(app_slug))
        cursor = conn.cursor()
        _init_chatt_table(cursor)
        
        cursor.execute('''
            UPDATE chat_message SET is_read = 1 
            WHERE emisor = ? AND receptor = ? AND is_read = 0
        ''', (emisor, receptor))
        
        conn.commit()
        conn.close()
        return _corsify(jsonify({"status": "ok"})), 200
    except Exception as e:
        return _corsify(jsonify({"error": str(e)})), 500

@chatt_bp.route('/api/<app_slug>/chatt/unread/<usuario>', methods=['GET', 'OPTIONS'])
def unread_t(app_slug, usuario):
    if request.method == 'OPTIONS': return _preflight()
    try:
        conn = sqlite3.connect(get_db_path(app_slug))
        cursor = conn.cursor()
        _init_chatt_table(cursor)
        
        cursor.execute('SELECT COUNT(*) FROM chat_message WHERE receptor = ? AND is_read = 0', (usuario,))
        count = cursor.fetchone()[0]
        
        conn.close()
        return _corsify(jsonify({"status": "ok", "unread": count})), 200
    except Exception as e:
        return _corsify(jsonify({"error": str(e)})), 500

@chatt_bp.route('/api/<app_slug>/chatt/limpiar', methods=['POST', 'OPTIONS'])
def limpiar_t(app_slug):
    if request.method == 'OPTIONS': return _preflight()
    try:
        data = request.get_json()
        emisor = data.get('emisor')
        receptor = data.get('receptor')
        
        conn = sqlite3.connect(get_db_path(app_slug))
        cursor = conn.cursor()
        _init_chatt_table(cursor)
        
        cursor.execute('''
            DELETE FROM chat_message 
            WHERE (emisor = ? AND receptor = ?) OR (emisor = ? AND receptor = ?)
        ''', (emisor, receptor, receptor, emisor))
        
        conn.commit()
        conn.close()
        return _corsify(jsonify({"status": "ok"})), 200
    except Exception as e:
        return _corsify(jsonify({"error": str(e)})), 500

# === NEW ROUTE TO DELETE SPECIFIC MESSAGE ===
@chatt_bp.route('/api/<app_slug>/chatt/borrar_mensaje', methods=['POST', 'OPTIONS'])
def borrar_mensaje_t(app_slug):
    """Deletes a specific message from the database (For both sides)"""
    if request.method == 'OPTIONS': return _preflight()
    try:
        data = request.get_json()
        mensaje_id = data.get('id')
        
        if not mensaje_id:
            return _corsify(jsonify({"error": "ID de mensaje no proporcionado"})), 400
            
        conn = sqlite3.connect(get_db_path(app_slug))
        cursor = conn.cursor()
        _init_chatt_table(cursor)
        
        cursor.execute('DELETE FROM chat_message WHERE id = ?', (mensaje_id,))
        
        conn.commit()
        conn.close()
        return _corsify(jsonify({"status": "ok"})), 200
    except Exception as e:
        return _corsify(jsonify({"error": str(e)})), 500

@chatt_bp.route('/api/<app_slug>/chatt/subir', methods=['POST', 'OPTIONS'])
def subir_t(app_slug):
    if request.method == 'OPTIONS': return _preflight()
    try:
        if 'archivo' not in request.files:
            return _corsify(jsonify({"error": "No hay archivo adjunto"})), 400
            
        file = request.files['archivo']
        if file.filename == '':
            return _corsify(jsonify({"error": "No seleccionaste ningún archivo"})), 400
            
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            timestamp_str = datetime.now().strftime("%Y%m%d%H%M%S")
            unique_filename = f"{timestamp_str}_{filename}"
            file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
            
            file.save(file_path)
            
            file_url = f"https://kenth1977.pythonanywhere.com/uploads/{unique_filename}"
            return _corsify(jsonify({"status": "ok", "url": file_url})), 200
        else:
            return _corsify(jsonify({"error": "Extensión de archivo no permitida"})), 400
            
    except Exception as e:
        return _corsify(jsonify({"error": str(e)})), 500

# === NUEVA RUTA PARA ELIMINAR EL ESTADO FANTASMA AL SALIR ===
@chatt_bp.route('/api/<app_slug>/chatt/logout', methods=['POST', 'OPTIONS'])
def logout_t(app_slug):
    """Elimina al usuario de la tabla de estado inmediatamente al cerrar sesión"""
    if request.method == 'OPTIONS': return _preflight()
    try:
        data = request.get_json()
        usuario = data.get('usuario')
        if not usuario: return _corsify(jsonify({"error": "Falta usuario"})), 400
        
        conn = sqlite3.connect(get_db_path(app_slug))
        cursor = conn.cursor()
        _init_chatt_table(cursor)
        
        # Al eliminar su registro, la función contactos_t ya no lo verá en línea
        cursor.execute('DELETE FROM user_status WHERE nombre = ?', (usuario,))
        
        conn.commit()
        conn.close()
        return _corsify(jsonify({"status": "ok", "message": "Desconectado correctamente"})), 200
    except Exception as e:
        return _corsify(jsonify({"error": str(e)})), 500

# === NEW FIX FOR CORS LOGOUT_STATUS ===
@chatt_bp.route('/api/<app_slug>/chatt/logout_status', methods=['GET', 'POST', 'OPTIONS'])
def check_logout_status(app_slug):
    """Fixes the CORS preflight issue for the frontend's logout status check"""
    # 1. Handle the CORS Preflight request
    if request.method == 'OPTIONS':
        return _preflight()
        
    try:
        # 2. Add actual logout verification logic here if needed.
        # For now, we return a standard 'ok' status to satisfy the frontend.
        response_data = {
            "status": "ok",
            "message": "Status checked successfully",
            "logged_out": False
        }
        
        # 3. Return the JSON response wrapped in your CORS helper
        return _corsify(jsonify(response_data)), 200
        
    except Exception as e:
        return _corsify(jsonify({"error": str(e)})), 500