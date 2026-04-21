// ============================================================
// EXPERIMENTO 1: Shadow block con enum de conversión
// ============================================================
// 
// OBJETIVO: Lograr un dropdown de clases en el bloque 
// "Al detectar clase" manteniendo la compatibilidad con 
// el protocolo UART actual (strings por BLE).
//
// CÓMO PROBAR:
// 1. Crear un nuevo proyecto en MakeCode (makecode.microbit.org)
// 2. Click en JavaScript (para ver/editar código)
// 3. Click en Explorer (panel izquierdo) → + (agregar archivo)
// 4. Crear un archivo llamado "tm-microbit-link.ts"
// 5. Pegar TODO este contenido
// 6. Crear otro archivo "tm-classes.ts" con el contenido 
//    indicado más abajo (ARCHIVO 2)
// 7. Volver a Bloques y verificar que aparece el dropdown
//
// ============================================================


/**
 * Extensión para vincular Teachable Machine con micro:bit
 */
//% weight=200 color=#2ecc71 icon="\uf0e8" block="TM-micro:bit-Link"
namespace iaMachine {

    let ultimaClase = "ninguna";
    let claseEmitida = "ninguna";
    let certezaActual = 0;
    const IA_EVENT_ID = 9100;
    let procesandoEvento = false;
    let autoConfirmar = false;

    bluetooth.startUartService();

    function generarId(texto: string): number {
        let hash = 0;
        for (let i = 0; i < texto.length; i++) {
            hash = Math.imul(31, hash) + texto.charCodeAt(i) | 0;
        }
        return Math.abs(hash);
    }

    // PROCESADOR DE DATOS
    bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
        let datos = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine));
        datos = datos.trim();
        if (datos.length > 0) {
            let partes = datos.split("#");
            if (partes.length === 2) {
                let claseRecibida = partes[0];
                let certezaRecibida = parseInt(partes[1]);
                ultimaClase = claseRecibida;
                certezaActual = certezaRecibida;
                // Flanco: emitir el evento solo cuando la clase detectada
                // cambia respecto a la última emitida. Evita disparar los
                // handlers de `alDetectarClase` y `alDetectarCualquierClase`
                // en ráfaga con cada paquete BLE (causa raíz del panic 070
                // al combinarse con `music.play`).
                if (claseRecibida !== claseEmitida) {
                    claseEmitida = claseRecibida;
                    control.raiseEvent(IA_EVENT_ID, generarId(claseRecibida));
                }
            }
        }
    });

    //% blockId=ia_on_class_threshold
    //% block="al detectar %clase con certeza > %umbral"
    //% umbral.min=0 umbral.max=100 umbral.defl=80
    //% clase.shadow="tm_clase_picker"
    //% weight=100
    export function alDetectarClase(clase: number, umbral: number, handler: () => void) {
        let nombreClase = _tmClaseNombres[clase] || "desconocido";
        control.onEvent(IA_EVENT_ID, generarId(nombreClase), function () {
            if (procesandoEvento) return;
            if (certezaActual >= umbral && ultimaClase === nombreClase) {
                procesandoEvento = true;
                handler();
                procesandoEvento = false;
                if (autoConfirmar) {
                    bluetooth.uartWriteString("OK\n");
                }
            }
        });
    }

    /**
     * Se ejecuta cuando se detecta cualquier clase que supere el umbral.
     */
    //% blockId=ia_on_any_class
    //% block="al detectar cualquier clase con certeza > %umbral"
    //% umbral.min=0 umbral.max=100 umbral.defl=80
    //% weight=95
    export function alDetectarCualquierClase(umbral: number, handler: () => void) {
        control.onEvent(IA_EVENT_ID, 0, function () {
            if (procesandoEvento) return;
            if (certezaActual >= umbral) {
                procesandoEvento = true;
                handler();
                procesandoEvento = false;
                if (autoConfirmar) {
                    bluetooth.uartWriteString("OK\n");
                }
            }
        });
    }

    /**
     * Se ejecuta continuamente mientras se detecta la clase indicada
     * con una certeza igual o superior al umbral. El código dentro del
     * bloque controla su propio ritmo mediante `pause` o reproducciones
     * sincrónicas (por ejemplo `music.play(..., UntilDone)`).
     */
    //% blockId=ia_while_class_threshold
    //% block="mientras se detecta %clase con certeza > %umbral"
    //% umbral.min=0 umbral.max=100 umbral.defl=80
    //% clase.shadow="tm_clase_picker"
    //% weight=98
    export function mientrasSeDetecta(clase: number, umbral: number, handler: () => void) {
        let nombreClase = _tmClaseNombres[clase] || "desconocido";
        control.inBackground(function () {
            while (true) {
                if (ultimaClase === nombreClase && certezaActual >= umbral) {
                    handler();
                }
                basic.pause(20);
            }
        });
    }

    /**
     * Devuelve el nombre de la última clase recibida.
     */
    //% blockId=ia_get_class
    //% block="clase detectada"
    //% weight=90
    export function claseDetectada(): string {
        return ultimaClase;
    }

    /**
     * Devuelve la certeza de la última detección (0-100).
     */
    //% blockId=ia_get_certainty
    //% block="certeza detectada"
    //% weight=85
    export function certezaDetectada(): number {
        return certezaActual;
    }

    /**
     * Habilitar modo controlado
     */
    //% blockId=ia_enable_flow_control
    //% block="habilitar modo controlado"
    //% weight=80
    //% advanced=true
    export function habilitarModoControlado() {
        autoConfirmar = true;
    }

    /**
     * Deshabilitar modo controlado
     */
    //% blockId=ia_disable_flow_control
    //% block="deshabilitar modo controlado"
    //% weight=79
    //% advanced=true
    export function deshabilitarModoControlado() {
        autoConfirmar = false;
    }

    /**
     * Enviar confirmación manual a la app
     */
    //% blockId=ia_send_ready
    //% block="enviar señal de listo"
    //% weight=78
    //% advanced=true
    export function enviarListo() {
        bluetooth.uartWriteString("OK\n");
    }

    // --- Bloques de Conexión ---

    /**
     * Se ejecuta cuando se conecta a la app
     */
    //% blockId=ia_on_connected
    //% block="al conectar a la app"
    //% weight=70
    export function alConectar(handler: () => void) {
        bluetooth.onBluetoothConnected(handler);
    }

    /**
     * Se ejecuta cuando se desconecta de la app
     */
    //% blockId=ia_on_disconnected
    //% block="al desconectar de la app"
    //% weight=69
    export function alDesconectar(handler: () => void) {
        bluetooth.onBluetoothDisconnected(handler);
    }
}
