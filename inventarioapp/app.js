
/* =====================================
   INVENTARIOAPP
   APLICACION PRINCIPAL
===================================== */

const { createClient } = supabase;

const CONFIG = window.INVENTARIO_CONFIG;

let db;
let productos = [];
let areas = [];
let instalacion = null;

/* =====================================
   UTILIDADES
===================================== */

// Obtener elemento HTML
const $ = id => document.getElementById(id);

// Fecha actual
const hoy = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();

    return new Date(d.getTime() - offset * 60000)
        .toISOString()
        .slice(0, 10);
};

// Mostrar mensajes
function mensaje(texto, tipo = "") {
    const elemento = $("status");

    if (!elemento) return;

    elemento.textContent = texto;
    elemento.className = "status " + tipo;
}

// Protección de texto HTML
function seguro(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, letra => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[letra]);
}

// Formato de moneda mexicana
function moneda(valor) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN"
    }).format(Number(valor) || 0);
}

// Manejo de errores
function manejarError(error) {
    console.error(error);
    mensaje(error.message || "Ocurrió un error.", "error");
}

/* =====================================
   NAVEGACION
===================================== */

function configurarNavegacion() {
    document.querySelectorAll(".nav-btn").forEach(boton => {
        boton.addEventListener("click", () => {
            const vista = boton.dataset.view;

            document.querySelectorAll(".view")
                .forEach(v => v.classList.add("hidden"));

            const destino = $("view-" + vista);

            if (destino) {
                destino.classList.remove("hidden");
            }

            document.querySelectorAll(".nav-btn")
                .forEach(b => b.classList.remove("active"));

            boton.classList.add("active");
        });
    });
}

/* =====================================
   CONEXION CON SUPABASE
===================================== */

async function conectar() {

    if (
        !CONFIG ||
        !CONFIG.SUPABASE_URL ||
        !CONFIG.SUPABASE_ANON_KEY
    ) {
        throw new Error(
            "Revisa la configuración de Supabase en config.js."
        );
    }

    if (typeof createClient !== "function") {
        throw new Error(
            "No se encontró Supabase. Revisa la conexión de index.html."
        );
    }

    db = createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_ANON_KEY
    );

    await cargarDatos();

    mensaje(
        "Inventario conectado correctamente.",
        "ok"
    );

    // Registrar Service Worker
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./sw.js")
            .catch(console.error);
    }
}

/* =====================================
   CARGAR DATOS
===================================== */

async function cargarDatos() {

    const resultadoAreas = await db
        .from("areas")
        .select("*")
        .order("nombre");

    const resultadoProductos = await db
        .from("productos")
        .select("*, areas(nombre)")
        .order("nombre");

    if (resultadoAreas.error) {
        throw resultadoAreas.error;
    }

    if (resultadoProductos.error) {
        throw resultadoProductos.error;
    }

    areas = resultadoAreas.data || [];
    productos = resultadoProductos.data || [];

    actualizarPantalla();
}

/* =====================================
   ACTUALIZAR PANEL
===================================== */

function actualizarPantalla() {

    const unidades = productos.reduce(
        (total, p) => total + Number(p.cantidad),
        0
    );

    const valor = productos.reduce(
        (total, p) =>
            total + Number(p.cantidad) * Number(p.precio),
        0
    );

    $("statProducts").textContent = productos.length;

    $("statUnits").textContent =
        unidades.toLocaleString("es-MX");

    $("statValue").textContent = moneda(valor);

    // Selector de áreas
    $("productArea").innerHTML =
        '<option value="">Sin área</option>' +
        areas.map(a => `
            <option value="${a.id}">
                ${seguro(a.nombre)}
            </option>
        `).join("");

    // Selector de productos para movimientos
    $("movementProduct").innerHTML =
        '<option value="">Selecciona un producto</option>' +
        productos.map(p => `
            <option value="${p.id}">
                ${seguro(p.nombre)}
                (${Number(p.cantidad)} disponibles)
            </option>
        `).join("");

    mostrarAreas();
    mostrarProductos();
}

/* =====================================
   AREAS
===================================== */

function mostrarAreas() {

    if (!areas.length) {
        $("areasList").innerHTML =
            '<div class="empty">Todavía no hay áreas.</div>';

        return;
    }

    $("areasList").innerHTML = areas.map(a => {

        const total = productos.filter(
            p => p.area_id === a.id
        ).length;

        return `
            <div class="item">
                <div>
                    <strong>${seguro(a.nombre)}</strong>
                    <small>${total} productos</small>
                </div>

                <button class="danger"
                    data-delete-area="${a.id}">
                    Eliminar
                </button>
            </div>
        `;

    }).join("");
}

/* =====================================
   REGISTRAR AREA
===================================== */

async function registrarArea(e) {

    e.preventDefault();

    const nombre = $("areaName").value.trim();

    if (!nombre) {
        mensaje("Escribe el nombre del área.", "error");
        return;
    }

    const { error } = await db
        .from("areas")
        .insert({ nombre });

    if (error) {
        manejarError(error);
        return;
    }

    $("areaName").value = "";

    await cargarDatos();

    mensaje("Área registrada correctamente.", "ok");
}

/* =====================================
   PRODUCTOS
===================================== */

function mostrarProductos() {

    const busqueda = $("productSearch").value
        .trim()
        .toLowerCase();

    const filtrados = productos.filter(p =>
        p.nombre.toLowerCase().includes(busqueda)
    );

    if (!filtrados.length) {
        $("productsList").innerHTML =
            '<div class="empty">No hay productos registrados.</div>';

        return;
    }

    $("productsList").innerHTML = filtrados.map(p => {

        const total =
            Number(p.cantidad) * Number(p.precio);

        return `
            <div class="item">

                <div>
                    <strong>${seguro(p.nombre)}</strong>

                    <small>
                        Área: ${seguro(p.areas?.nombre || "Sin área")}
                    </small>

                    <small>
                        Cantidad: ${Number(p.cantidad)}
                    </small>

                    <small>
                        Precio: ${moneda(p.precio)}
                    </small>
                </div>

                <div class="item-right">
                    <strong>${moneda(total)}</strong>

                    <small>Valor total</small>

                    <button class="danger"
                        data-delete-product="${p.id}">
                        Eliminar
                    </button>
                </div>

            </div>
        `;

    }).join("");
}

/* =====================================
   REGISTRAR PRODUCTO
===================================== */

async function registrarProducto(e) {

    e.preventDefault();

    const nombre = $("productName").value.trim();
    const cantidad = Number($("productQty").value);
    const precio = Number($("productPrice").value);
    const area = $("productArea").value;

    if (
        !nombre ||
        !Number.isFinite(cantidad) ||
        !Number.isFinite(precio) ||
        cantidad < 0 ||
        precio < 0
    ) {
        mensaje("Revisa los datos del producto.", "error");
        return;
    }

    const { data, error } = await db
        .from("productos")
        .insert({
            nombre,
            cantidad,
            precio,
            area_id: area ? Number(area) : null
        })
        .select()
        .single();

    if (error) {
        manejarError(error);
        return;
    }

    // Registrar existencia inicial
    if (cantidad > 0) {

        const { error: movimientoError } = await db
            .from("movimientos")
            .insert({
                producto_id: data.id,
                tipo: "entrada",
                cantidad,
                nota: "Existencia inicial"
            });

        if (movimientoError) {
            mensaje(
                "Producto guardado, pero falló el registro inicial: " +
                movimientoError.message,
                "error"
            );

            await cargarDatos();
            return;
        }
    }

    $("productForm").reset();

    $("productQty").value = 0;
    $("productPrice").value = 0;

    await cargarDatos();

    mensaje("Producto agregado correctamente.", "ok");
}

/* =====================================
   ELIMINAR AREAS Y PRODUCTOS
===================================== */

async function eliminarElemento(e) {

    const boton = e.target.closest(
        "[data-delete-area], [data-delete-product]"
    );

    if (!boton) return;

    const areaId = boton.dataset.deleteArea;
    const productId = boton.dataset.deleteProduct;

    if (areaId) {

        if (!confirm("¿Eliminar esta área?")) return;

        const { error } = await db
            .from("areas")
            .delete()
            .eq("id", areaId);

        if (error) {
            manejarError(error);
            return;
        }

        await cargarDatos();

        mensaje("Área eliminada.", "ok");
    }

    if (productId) {

        if (!confirm(
            "¿Eliminar este producto y su historial?"
        )) return;

        const { error } = await db
            .from("productos")
            .delete()
            .eq("id", productId);

        if (error) {
            manejarError(error);
            return;
        }

        await cargarDatos();

        mensaje("Producto eliminado.", "ok");
    }
}

/* =====================================
   BUSCADOR
===================================== */

function configurarBuscador() {

    $("productSearch").addEventListener(
        "input",
        mostrarProductos
    );
}

/* =====================================
   ENTRADAS Y SALIDAS
===================================== */

async function registrarMovimiento(e) {

    e.preventDefault();

    const productoId = Number(
        $("movementProduct").value
    );

    const tipo = $("movementType").value;

    const cantidad = Number(
        $("movementQty").value
    );

    const nota = $("movementNote").value.trim();

    if (
        !productoId ||
        !Number.isFinite(cantidad) ||
        cantidad <= 0
    ) {
        mensaje(
            "Selecciona un producto y una cantidad válida.",
            "error"
        );

        return;
    }

    if (!["entrada", "salida"].includes(tipo)) {
        mensaje("Selecciona un tipo de movimiento válido.", "error");
        return;
    }

    const producto = productos.find(
        p => p.id === productoId
    );

    if (!producto) {
        mensaje("No se encontró el producto.", "error");
        return;
    }

    if (
        tipo === "salida" &&
        cantidad > Number(producto.cantidad)
    ) {
        mensaje(
            "No hay suficientes existencias para esta salida.",
            "error"
        );

        return;
    }

    // Esta función SQL se configurará en Supabase.
    const { error } = await db.rpc("registrar_movimiento", {
        p_producto_id: productoId,
        p_tipo: tipo,
        p_cantidad: cantidad,
        p_nota: nota || null
    });

    if (error) {
        manejarError(error);
        return;
    }

    $("movementForm").reset();

    await cargarDatos();

    await cargarHistorial($("historyDate").value);
    await cargarDia($("dashboardDate").value);

    mensaje(
        "Movimiento registrado correctamente.",
        "ok"
    );
}

/* =====================================
   CONSULTAR MOVIMIENTOS POR FECHA
===================================== */

async function obtenerMovimientos(fecha) {

    if (!fecha) return [];

    const inicio = new Date(
        fecha + "T00:00:00"
    ).toISOString();

    const fin = new Date(
        new Date(fecha + "T00:00:00").getTime() +
        86400000
    ).toISOString();

    const { data, error } = await db
        .from("movimientos")
        .select("*, productos(nombre)")
        .gte("fecha", inicio)
        .lt("fecha", fin)
        .order("fecha", { ascending: false });

    if (error) throw error;

    return data || [];
}

/* =====================================
   MOSTRAR HISTORIAL
===================================== */

function dibujarMovimientos(lista) {

    if (!lista.length) {
        return `
            <div class="empty">
                No hay movimientos registrados.
            </div>
        `;
    }

    return lista.map(m => {

        const hora = new Date(m.fecha)
            .toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit"
            });

        const signo =
            m.tipo === "entrada" ? "+" : "−";

        return `
            <div class="item">

                <div>
                    <strong>
                        ${seguro(
                            m.productos?.nombre ||
                            "Producto eliminado"
                        )}
                    </strong>

                    <small>
                        ${hora} · ${seguro(m.nota || "Sin nota")}
                    </small>

                    <small>
                        ${m.tipo.toUpperCase()}
                    </small>
                </div>

                <div class="item-right">
                    <strong>
                        ${signo}${Number(m.cantidad)}
                    </strong>
                </div>

            </div>
        `;

    }).join("");
}

/* =====================================
   HISTORIAL
===================================== */

async function cargarHistorial(fecha) {

    try {

        const lista = await obtenerMovimientos(fecha);

        $("historyList").innerHTML =
            dibujarMovimientos(lista);

    } catch (error) {
        manejarError(error);
    }
}

/* =====================================
   MOVIMIENTOS DEL DIA
===================================== */

async function cargarDia(fecha) {

    try {

        const lista = await obtenerMovimientos(fecha);

        $("dayMovements").innerHTML =
            dibujarMovimientos(lista);

    } catch (error) {
        manejarError(error);
    }
}

/* =====================================
   CAMBIOS DE FECHA
===================================== */

function configurarFechas() {

    $("historyDate").addEventListener(
        "change",
        () => cargarHistorial($("historyDate").value)
    );

    $("dashboardDate").addEventListener(
        "change",
        () => cargarDia($("dashboardDate").value)
    );
}

/* =====================================
   INSTALACION DE LA APLICACION
===================================== */

function configurarInstalacion() {

    window.addEventListener(
        "beforeinstallprompt",
        event => {

            event.preventDefault();

            instalacion = event;

            $("installBtn").classList.remove("hidden");
        }
    );

    $("installBtn").addEventListener(
        "click",
        async () => {

            if (!instalacion) return;

            instalacion.prompt();

            await instalacion.userChoice;

            instalacion = null;

            $("installBtn").classList.add("hidden");
        }
    );
}

/* =====================================
   INICIAR APLICACION
===================================== */

async function iniciarAplicacion() {

    try {

        $("dashboardDate").value = hoy();
        $("historyDate").value = hoy();

        configurarNavegacion();

        $("areaForm").addEventListener(
            "submit",
            registrarArea
        );

        $("productForm").addEventListener(
            "submit",
            registrarProducto
        );

        $("movementForm").addEventListener(
            "submit",
            registrarMovimiento
        );

        document.addEventListener(
            "click",
            eliminarElemento
        );

        configurarBuscador();
        configurarFechas();
        configurarInstalacion();

        await conectar();

        await cargarHistorial(hoy());
        await cargarDia(hoy());

    } catch (error) {

        console.error(error);

        mensaje(
            error.message || "No se pudo iniciar la aplicación.",
            "error"
        );
    }
}

iniciarAplicacion();
