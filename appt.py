import os
import logging
from flask import Blueprint, request, jsonify, send_from_directory
from flask_bcrypt import Bcrypt
from sqlalchemy import create_engine, Column, Integer, String, MetaData, Table

# ==========================================
# 1. INICIALIZACIÓN DEL BLUEPRINT (PADRE)
# ==========================================
# Este módulo centraliza la lógica de "La Tribu" (App T)
appt_bp = Blueprint('appt_api', __name__)

# Instanciamos Bcrypt para el manejo seguro de contraseñas
bcrypt = Bcrypt()

# ==========================================
# 2. CONEXIÓN CON EL HIJO (CHATT)
# ==========================================
# Importamos el chat específico 'T' y lo registramos en este Blueprint
from chatt import chatt_bp
appt_bp.register_blueprint(chatt_bp)

# ==========================================
# 3. CONFIGURACIÓN DE RUTAS Y DBs
# ==========================================
BASE_DB_PATH = '/home/kenth1977/myDBs/DBs'
BASE_UPDATE_PATH = '/home/kenth1977/myDBs/updates'

# Diccionario para cachear motores de base de datos
db_engines = {}

def get_engine(app_slug):
    """Obtiene o crea el motor SQLite para la base de datos solicitada"""
    if app_slug not in db_engines:
        db_path = os.path.join(BASE_DB_PATH, f"{app_slug}.db")
        # check_same_thread=False es vital para SQLite en entornos Flask
        engine = create_engine(f"sqlite:///{db_path}", connect_args={'check_same_thread': False})
        db_engines[app_slug] = engine
    return db_engines[app_slug]

def init_db(app_slug):
    """Inicializa la tabla de miembros (member) sin la columna PIN"""
    engine = get_engine(app_slug)
    metadata = MetaData()
    
    # Definición de la tabla Member reformada
    member_table = Table('member', metadata,
        Column('id', Integer, primary_key=True, autoincrement=True),
        Column('nombre', String(100)),
        Column('apellido1', String(100), default=""),
        Column('email', String(100), unique=True),
        Column('password', String(200)),
        Column('telefono', String(20), default="00000000"),
        Column('rol', String(20), default='usuario')
    )
    metadata.create_all(engine)
    return member_table

# ==========================================
# 4. RUTAS DE LA API (APP T)
# ==========================================

@appt_bp.route('/api/<app_slug>/crear_ahora', methods=['GET'])
def crear_ahora(app_slug):
    """Ruta para inicializar la base de datos manualmente desde el navegador"""
    try:
        init_db(app_slug)
        # Devolvemos HTML simple para que se vea bonito en el navegador
        return f"""
        <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f8f9fa;">
                <h1 style="color: #198754;">¡Éxito! ✅</h1>
                <p style="font-size: 18px; color: #333;">La base de datos para la aplicación <b>{app_slug}</b> ha sido inicializada.</p>
                <p style="color: #6c757d;">Ruta del archivo: {BASE_DB_PATH}/{app_slug}.db</p>
            </body>
        </html>
        """, 200
    except Exception as e:
        return f"<h1>Error al crear la base de datos</h1><p>{str(e)}</p>", 500

@appt_bp.route('/api/<app_slug>/registro', methods=['POST', 'OPTIONS'])
def registro(app_slug):
    """Proceso inteligente: Login o Registro separados lógicamente"""
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200

    data = request.get_json()
    if not data:
        return jsonify({"error": "No se recibieron datos en la petición"}), 400

    nombre = data.get('nombre')
    password = data.get('password')
    es_registro = data.get('esRegistro', False) # <-- ¡NUEVO! Detectar si es registro

    if not nombre or not password:
        return jsonify({"error": "Nombre de usuario y contraseña son obligatorios"}), 400

    # Normalización de datos
    nombre_usuario = nombre.strip()
    email_ficticio = f"{nombre_usuario.replace(' ', '').lower()}@temp.chat"
    
    # --- VALIDACIÓN DE SUPERUSUARIOS ---
    es_super = nombre_usuario.lower() in ['kenth1977@gmail.com', 'lthikingcr@gmail.com']
    rol = "usuario"
    
    if es_super:
        if password == 'CR129x7848n':
            rol = "superadmin"
        else:
            return jsonify({"error": "Contraseña maestra incorrecta para este perfil."}), 403

    try:
        member_table = init_db(app_slug)
        engine = get_engine(app_slug)
        
        with engine.connect() as conn:
            # Verificar si el nombre ya está registrado
            usuario_existente = conn.execute(
                member_table.select().where(member_table.c.nombre == nombre_usuario)
            ).fetchone()
            
            if usuario_existente:
                if es_registro:
                    return jsonify({"error": "Este usuario ya existe. Por favor, inicia sesión."}), 400

                # ==========================================
                # MODO LOGIN: El usuario ya existe
                # ==========================================
                
                # Caso Superusuario
                if es_super and password == 'CR129x7949n':
                    return jsonify({
                        "status": "ok", 
                        "mensaje": f"Bienvenido de nuevo, Admin {nombre_usuario}.",
                        "rol": "superadmin"
                    })
                
                # Caso Usuario Normal
                hash_guardado = getattr(usuario_existente, 'password', usuario_existente[4])
                rol_guardado = getattr(usuario_existente, 'rol', usuario_existente[6])
                
                if bcrypt.check_password_hash(hash_guardado, password):
                    return jsonify({
                        "status": "ok", 
                        "mensaje": f"Bienvenido de nuevo, {nombre_usuario}.",
                        "rol": rol_guardado
                    })
                else:
                    return jsonify({"error": "El usuario ya existe, pero la contraseña es incorrecta."}), 401
            
            else:
                # El usuario NO existe en la base de datos
                if es_registro:
                    # ==========================================
                    # MODO REGISTRO LEGÍTIMO
                    # ==========================================
                    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
                    
                    conn.execute(member_table.insert().values(
                        nombre=nombre_usuario,
                        email=email_ficticio,
                        password=hashed_password,
                        rol=rol
                    ))
                    conn.commit()

                    return jsonify({
                        "status": "ok", 
                        "mensaje": f"Usuario {nombre_usuario} registrado exitosamente.",
                        "rol": rol
                    })
                else:
                    # ==========================================
                    # MODO BARRERA: Intentó loguearse pero no existe
                    # ==========================================
                    return jsonify({"error": "Acceso denegado: Este usuario NO está registrado."}), 404

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@appt_bp.route('/api/<app_slug>/check_update', methods=['GET', 'OPTIONS'])
def check_update(app_slug):
    """Manejo de actualizaciones OTA para la interfaz de la App T"""
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200

    try:
        zip_path = os.path.join(BASE_UPDATE_PATH, 'www.zip')
        timestamp = "0"
        if os.path.exists(zip_path):
            timestamp = str(int(os.path.getmtime(zip_path)))

        return jsonify({
            "status": "ok",
            "version": "2.0.0", 
            "timestamp": timestamp,
            "url": f"https://kenth1977.pythonanywhere.com/api/{app_slug}/descargar_update"
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500


@appt_bp.route('/api/<app_slug>/descargar_update', methods=['GET'])
def descargar_update(app_slug):
    """Permite la descarga del archivo de actualización"""
    return send_from_directory(BASE_UPDATE_PATH, 'www.zip', as_attachment=True)