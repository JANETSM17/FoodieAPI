const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const ver1 = require('./src/vers1/routes/rutas');

app.use(express.json()); // Middleware para parsear JSON

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
        return res.status(200).json({});
    }
    next();
});

app.use('/foodieAPI', ver1);

app.listen(port, () => {
    console.log(`Conectado al puerto ${port}`);
});
