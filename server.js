const express = require('express');
const {
    useMultiFileAuthState,
    makeWASocket,
} = require('@whiskeysockets/baileys');
const bodyParser = require('body-parser');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

let sock;
let isConnected = false;

app.use(bodyParser.json({ limit: '10mb' })); // Aumentar el límite de tamaño de carga

//======================
// Conexión a WhatsApp
//======================
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('session');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['BaileysBot', 'Chrome', '1.0.0'],
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true }); // Muestra QR en terminal
        }

        if (connection === 'open') {
            isConnected = true;
            console.log('¡Conectado a WhatsApp!');
        }

        if (connection === 'close') {
            isConnected = false;
            connectToWhatsApp(); // Reconectar
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

//==============================
// Endpoint para enviar imagen
//==============================
app.get('/send-img', async (req, res) => {
    const { phone, imageUrl } = req.query;

    if (!isConnected) {
        return res.status(400).send('Escanea el código QR primero');
    }

    if (!phone || !imageUrl) {
        return res.status(400).send('Parámetros faltantes');
    }

    try {
        // Descargar imagen
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
        });
        const imageBuffer = Buffer.from(response.data, 'binary');
        const mimeType = response.headers['content-type'];

        // Enviar mensaje
        const jid = `${phone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        await sock.sendMessage(jid, {
            image: imageBuffer,
            mimetype: mimeType,
            caption: 'Imagen enviada desde Node.js 🚀',
        });

        res.send('Imagen enviada correctamente');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al enviar la imagen');
    }
});

//==============================
// Endpoint para enviar archivo
//==============================
app.post('/send-file', async (req, res) => {
    const { phone, fileName, fileData } = req.body;

    if (!isConnected) {
        return res.status(400).send('Escanea el código QR primero');
    }

    if (!phone || !fileName || !fileData) {
        return res.status(400).send('Parámetros faltantes');
    }

    try {
        const fileBuffer = Buffer.from(fileData, 'base64');

        const jid = `${phone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        await sock.sendMessage(jid, {
            document: fileBuffer,
            mimetype: 'image/jpeg',
            fileName: fileName,
            caption: 'Archivo enviado desde Node.js 🚀',
        });

        res.send('Archivo enviado correctamente');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al enviar el archivo');
    }
});

//==============================
// Endpoint para enviar texto
//==============================
app.post('/send-text', async (req, res) => {
    const { phone, message } = req.body;

    if (!isConnected) {
        return res.status(400).send('Escanea el código QR primero');
    }

    if (!phone || !message) {
        return res.status(400).send('Parámetros faltantes');
    }

    try {
        const jid = `${phone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        await sock.sendMessage(jid, {
            text: message,
        });

        res.send('Mensaje enviado correctamente');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al enviar el mensaje');
    }
});

//==============================
// Iniciar servidor y conexión
//==============================
connectToWhatsApp().then(() => {
    app.listen(port, () => {
        console.log(`Servidor listo en <http://localhost>:${port}`);
    });
});
